// Cloud sync with Supabase: one private row per user plus a private photo folder (RLS: owner only).
import { S, save, saveNow, hooks } from "./store.js";
import { photoGet, photoSet } from "./db.js";
import { photoHooks } from "./ui.js";
import { SUPABASE_URL, SUPABASE_KEY, TABLE, BUCKET } from "./config.js";

export const syncEnabled = !!(SUPABASE_URL && SUPABASE_KEY);
let sb = null;
export const sync = { user: null, status: "off", last: null, error: "" };
const listeners = new Set();
export const onSyncChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

async function client() {
  if (!sb) {
    const { createClient } = await import("../vendor/supabase.mjs");
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "gym-auth" } });
  }
  return sb;
}
const meta = () => (S.state.syncMeta ||= { lastSynced: null, dirty: false, pendingPhotos: [] });

function cloudCopy() { const { syncMeta, ...rest } = S.state; void syncMeta; return rest; }
const stamp = (x) => x?.updatedAt || x?.createdAt || "";
/** Both sides changed: keep every item, the newer copy wins when the same item changed on both. */
function merge(remote, local) {
  const gone = new Set([...(remote.deleted || []), ...(local.deleted || [])]);
  const out = { ...remote, deleted: [...gone] };
  for (const key of ["equipment", "measurements", "progressPhotos"]) {
    const byId = new Map((remote[key] || []).map((x) => [x.id, x]));
    for (const it of local[key] || []) { const r = byId.get(it.id); if (!r || stamp(it) > stamp(r)) byId.set(it.id, it); }
    out[key] = [...byId.values()].filter((x) => !gone.has(x.id));
  }
  out.days = { ...(remote.days || {}) };
  for (const [date, d] of Object.entries(local.days || {})) { const r = out.days[date]; if (!r || stamp(d) > stamp(r)) out.days[date] = d; }
  out.deletedAt = { ...(remote.deletedAt || {}), ...(local.deletedAt || {}) };
  for (const [id, at] of Object.entries(out.deletedAt)) if (id.startsWith("day:")) { const k = id.slice(4); if (out.days[k] && stamp(out.days[k]) <= at) delete out.days[k]; }
  out.week = (local.weekUpdatedAt || "") > (remote.weekUpdatedAt || "") ? local.week : remote.week;
  out.weekUpdatedAt = [local.weekUpdatedAt, remote.weekUpdatedAt].filter(Boolean).sort().pop() || null;
  out.profile = (local.profileUpdatedAt || "") > (remote.profileUpdatedAt || "") ? local.profile : remote.profile;
  return out;
}
function applyRemote(remote) {
  const m = meta();
  Object.assign(S.state, remote);
  S.state.syncMeta = m;
}
export const _internals = { merge, cloudCopy };

export async function initSync() {
  if (!syncEnabled) { emit(); return; }
  hooks.afterSave = schedulePush;
  photoHooks.uploaded = (id) => { meta().pendingPhotos ||= []; meta().pendingPhotos.push(id); };
  photoHooks.fetchMissing = fetchPhoto;
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    sync.user = data.session?.user || null;
    c.auth.onAuthStateChange((_e, session) => { sync.user = session?.user || null; emit(); });
    if (sync.user) await pull();
    document.addEventListener("visibilitychange", () => { if (!document.hidden && sync.user) pull(); });
    window.addEventListener("online", () => { if (sync.user) pull(); });
    setInterval(() => { if (sync.user && !document.hidden && navigator.onLine && sync.status !== "syncing" && !meta().dirty) pull(); }, 45000);
  } catch (e) { sync.status = "error"; sync.error = e.message; }
  emit();
}

export async function pull() {
  if (!sync.user || sync.status === "syncing") return;
  sync.status = "syncing"; emit();
  try {
    const c = await client();
    const { data, error } = await c.from(TABLE).select("state, updated_at").eq("user_id", sync.user.id).maybeSingle();
    if (error) throw error;
    const m = meta();
    if (!data) { sync.status = "ok"; await push(true); return; }
    const remoteNewer = !m.lastSynced || data.updated_at > m.lastSynced;
    if (remoteNewer && m.dirty) { applyRemote(merge(data.state, cloudCopy())); m.lastSynced = data.updated_at; await saveNow(); sync.status = "ok"; await push(true); window.__rerender?.(); return; }
    if (remoteNewer) { applyRemote(data.state); m.lastSynced = data.updated_at; m.dirty = false; await saveNow(); window.__applyTheme?.(); window.__rerender?.(); }
    else if (m.dirty) { sync.status = "ok"; await push(true); return; }
    sync.status = "ok"; sync.last = new Date().toISOString(); sync.error = "";
  } catch (e) { sync.status = navigator.onLine ? "error" : "offline"; sync.error = e.message || String(e); }
  emit();
}

let pushTimer;
export function schedulePush() {
  if (!sync.user) return;
  meta().dirty = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(), 2000);
}
export async function push(force = false) {
  if (!sync.user) return;
  sync.status = "syncing"; emit();
  try {
    const c = await client();
    const m = meta();
    await uploadPending(c);
    if (!force) {
      const { data } = await c.from(TABLE).select("updated_at").eq("user_id", sync.user.id).maybeSingle();
      if (data && m.lastSynced && data.updated_at > m.lastSynced) { sync.status = "ok"; await pull(); return; }
    }
    const { data, error } = await c.from(TABLE).upsert({ user_id: sync.user.id, state: cloudCopy(), device: navigator.userAgent.slice(0, 120) }).select("updated_at").single();
    if (error) throw error;
    m.lastSynced = data.updated_at; m.dirty = false;
    await saveNow();
    sync.status = "ok"; sync.last = new Date().toISOString(); sync.error = "";
  } catch (e) { sync.status = navigator.onLine ? "error" : "offline"; sync.error = e.message || String(e); }
  emit();
}
async function uploadPending(c) {
  const m = meta(); m.pendingPhotos ||= [];
  while (m.pendingPhotos.length) {
    const id = m.pendingPhotos[0];
    const blob = await photoGet(id);
    if (blob) {
      const { error } = await c.storage.from(BUCKET).upload(`${sync.user.id}/${id}.jpg`, blob, { contentType: "image/jpeg", upsert: true });
      if (error && !/exists/i.test(error.message)) throw error;
    }
    m.pendingPhotos.shift();
    await saveNow();
  }
}
/** A photo taken on another device: download it once and keep it here. */
async function fetchPhoto(id) {
  if (!sync.user) return null;
  try {
    const c = await client();
    const { data, error } = await c.storage.from(BUCKET).download(`${sync.user.id}/${id}.jpg`);
    if (error || !data) return null;
    await photoSet(id, data);
    return data;
  } catch { return null; }
}
/** After signing in on a device that already has photos, send them all up. */
async function queueAllPhotos() {
  const { photoKeys } = await import("./db.js");
  const m = meta(); m.pendingPhotos = [...new Set([...(m.pendingPhotos || []), ...(await photoKeys())])];
}

export async function signUp(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  if (data.session) { sync.user = data.user; await queueAllPhotos(); meta().dirty = true; await pull(); }
  return !!data.session;
}
export async function signIn(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  sync.user = data.user;
  const m = meta(); m.lastSynced = null;
  m.dirty = S.state.equipment.length + Object.keys(S.state.days).length + S.state.measurements.length > 0;
  await queueAllPhotos();
  await pull();
}
export async function signOut() {
  const c = await client();
  await c.auth.signOut();
  sync.user = null; sync.status = "off";
  const m = meta(); m.lastSynced = null; m.dirty = false;
  save(); emit();
}
export async function resetPassword(email) {
  const c = await client();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}
export function syncLabel() {
  if (!syncEnabled) return "Saved on this device";
  if (!sync.user) return "Not syncing";
  if (sync.status === "syncing") return "Syncing…";
  if (sync.status === "offline") return "Offline, will sync later";
  if (sync.status === "error") return "Sync problem";
  return "Synced";
}
