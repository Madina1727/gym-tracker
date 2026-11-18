// App state, saving, dates, units, and the planned-vs-actual logic.
import { kvGet, kvSet } from "./db.js";
import { isCardio, kindOf } from "./kinds.js";

export const S = { state: null };
export const hooks = { afterSave: null };
export const uid = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
export const now = () => new Date().toISOString();

export function emptyState() {
  return {
    v: 1, onboarded: false,
    profile: { name: "", units: "metric", theme: "system", goalPerWeek: 4, targetWeight: null, startWeight: null },
    equipment: [],            // {id, name, kind, muscles[], instructions, settings, favorite, photos[], createdAt, updatedAt}
    week: { 0: day0(), 1: day0(), 2: day0(), 3: day0(), 4: day0(), 5: day0(), 6: day0() }, // weekday templates, 0 = Sunday
    days: {},                 // "YYYY-MM-DD" -> {title, items[], photos[], note, startedAt, finishedAt, updatedAt}
    measurements: [],         // {id, date, weight, bodyFat, chest, waist, hips, arm, thigh, updatedAt}
    progressPhotos: [],       // {id, date, photo, note, pose, updatedAt}
    deleted: [],              // ids removed, so sync does not bring them back
    syncMeta: { lastSynced: null, dirty: false },
  };
}
function day0() { return { title: "", items: [], rest: false }; }

export async function load() {
  S.state = (await kvGet("state")) || emptyState();
  const e = emptyState();
  for (const k of Object.keys(e)) if (S.state[k] === undefined) S.state[k] = e[k];
  S.state.profile = { ...e.profile, ...S.state.profile };
}
let timer;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(saveNow, 250);
  hooks.afterSave?.();
}
export const saveNow = () => kvSet("state", S.state);

/* ---------- dates ---------- */
export const iso = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const today = () => iso();
export const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
export const weekday = (s) => parseDay(s).getDay();
/** Monday of the week the date is in. */
export const weekStart = (s) => addDays(s, -((weekday(s) + 6) % 7));
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
export const fmtDay = (s, opts = { weekday: "long", month: "short", day: "numeric" }) => parseDay(s).toLocaleDateString(undefined, opts);
export const shortDay = (s) => fmtDay(s, { month: "short", day: "numeric" });

/* ---------- units (stored metric) ---------- */
const imperial = () => S.state.profile.units === "imperial";
export const wUnit = () => imperial() ? "lb" : "kg";
export const dUnit = () => imperial() ? "mi" : "km";
export const sUnit = () => imperial() ? "mph" : "km/h";
export const lenUnit = () => imperial() ? "in" : "cm";
const round = (v, p = 1) => Math.round(v * 10 ** p) / 10 ** p;
export const toW = (kg) => kg == null || kg === "" ? "" : round(imperial() ? kg * 2.20462 : kg, 1);
export const fromW = (v) => v === "" || v == null || isNaN(v) ? null : imperial() ? +v / 2.20462 : +v;
export const toD = (km) => km == null || km === "" ? "" : round(imperial() ? km * 0.621371 : km, 2);
export const fromD = (v) => v === "" || v == null || isNaN(v) ? null : imperial() ? +v / 0.621371 : +v;
export const toLen = (cm) => cm == null || cm === "" ? "" : round(imperial() ? cm / 2.54 : cm, 1);
export const fromLen = (v) => v === "" || v == null || isNaN(v) ? null : imperial() ? +v * 2.54 : +v;
export function unitLabel(u) { return u === "dist" ? dUnit() : u === "speed" ? sUnit() : u; }
/** Field value in display units, and back. */
export function showField(f, v) { if (v == null || v === "") return ""; return f === "distance" ? toD(v) : f === "speed" ? toD(v) : v; }
export function readField(f, v) { if (v === "" || v == null || isNaN(v)) return null; return f === "distance" || f === "speed" ? fromD(v) : +v; }

/* ---------- equipment ---------- */
export const equip = (id) => S.state.equipment.find((e) => e.id === id);

/* ---------- days: planned vs actual ---------- */
export function newItem(src = {}) {
  return { id: uid(), equipmentId: src.equipmentId || null, name: src.name || "", kind: src.kind || "machine",
    target: { ...(src.target || {}) }, actual: { sets: [], skipped: false, note: "", photos: [] }, done: false };
}
export const itemName = (it) => (it.equipmentId && equip(it.equipmentId)?.name) || it.name || "Exercise";
export const itemKind = (it) => (it.equipmentId && equip(it.equipmentId)?.kind) || it.kind;

/** The plan for a date: the saved day, or the weekday template if nothing was saved for it yet. */
export function getDay(date) {
  const saved = S.state.days[date];
  if (saved) return saved;
  // Days before the person started using the app have no plan, so they never show as missed.
  if (S.state.startedOn && date < S.state.startedOn) return { title: "", rest: false, items: [], photos: [], note: "", virtual: true };
  const t = S.state.week[weekday(date)];
  return { title: t.title, rest: t.rest, items: t.items.map((i) => ({ ...newItem(i), id: i.id })), photos: [], note: "", virtual: true };
}
/** Make the date's plan its own copy (done before the first edit or log on that date). */
export function ensureDay(date) {
  if (S.state.days[date]) return S.state.days[date];
  const t = S.state.week[weekday(date)];
  const d = { title: t.title, rest: !!t.rest, items: t.items.map((i) => newItem(i)), photos: [], note: "", startedAt: null, finishedAt: null, updatedAt: now() };
  S.state.days[date] = d;
  return d;
}
export const touch = (d) => { d.updatedAt = now(); };

const num = (v) => (v == null || v === "" ? null : +v);
/** Status of one exercise: done (target met), partial (something logged), skipped, or todo. */
export function status(it) {
  const k = itemKind(it), t = it.target || {}, a = it.actual || {};
  if (a.skipped) return "skipped";
  if (isCardio(k)) {
    const keys = Object.keys(t).filter((f) => num(t[f]) != null && ["minutes", "distance", "floors", "calories", "steps"].includes(f));
    const logged = kindOf(k).fields.some((f) => num(a[f]) != null);
    if (!logged) return it.done ? "done" : "todo";
    if (!keys.length) return "done";
    return keys.every((f) => num(a[f]) >= num(t[f])) ? "done" : it.done ? "done-short" : "partial";
  }
  const sets = (a.sets || []).filter((s) => s.done || num(s.reps) != null);
  if (!sets.length) return it.done ? "done" : "todo";
  const tSets = num(t.sets), tReps = num(t.reps), tW = num(t.weight);
  if (!tSets) return "done";
  const good = sets.filter((s) => (tReps == null || num(s.reps ?? tReps) >= tReps) && (tW == null || num(s.weight ?? tW) >= tW - 0.01));
  return good.length >= tSets ? "done" : it.done ? "done-short" : "partial";
}
export const isComplete = (it) => { const s = status(it); return s === "done" || s === "done-short"; };
export function dayProgress(d) {
  const items = d.items || [];
  const done = items.filter(isComplete).length;
  return { done, total: items.length, pct: items.length ? done / items.length : 0 };
}
/** Did any logging happen that day? */
export const dayLogged = (d) => !!d && (d.items || []).some((it) => { const s = status(it); return s !== "todo" && s !== "skipped"; });

/** "3 × 12 · 40 kg" / "15 min · 2.0 km" */
export function targetText(it) {
  const k = itemKind(it), t = it.target || {};
  if (isCardio(k)) {
    const parts = kindOf(k).fields.filter((f) => num(t[f]) != null).map((f) => fieldText(f, t[f]));
    return parts.join(" · ") || "No target";
  }
  const p = [];
  if (num(t.sets)) p.push(`${t.sets} × ${num(t.reps) ?? "?"}`); else if (num(t.reps)) p.push(`${t.reps} reps`);
  if (num(t.weight) != null) p.push(`${toW(t.weight)} ${wUnit()}`);
  if (num(t.minutes)) p.push(`${t.minutes} min`);
  return p.join(" · ") || "No target";
}
export function actualText(it) {
  const k = itemKind(it), a = it.actual || {}, t = it.target || {};
  if (a.skipped) return "Skipped";
  if (isCardio(k)) {
    const parts = kindOf(k).fields.filter((f) => num(a[f]) != null).map((f) => fieldText(f, a[f]));
    return parts.join(" · ") || (it.done ? "Done" : "");
  }
  const sets = (a.sets || []).filter((s) => s.done || num(s.reps) != null).map((s) => ({ reps: num(s.reps) ?? num(t.reps), weight: num(s.weight) ?? num(t.weight) }));
  if (!sets.length) return it.done ? "Done" : "";
  const sameReps = sets.every((s) => s.reps === sets[0].reps), sameW = sets.every((s) => s.weight === sets[0].weight);
  let txt = sameReps ? `${sets.length} × ${sets[0].reps ?? "?"}` : sets.map((s) => s.reps ?? "?").join(", ") + " reps";
  if (sameW && sets[0].weight != null) txt += ` · ${toW(sets[0].weight)} ${wUnit()}`;
  else if (!sameW) txt += ` · up to ${toW(Math.max(...sets.map((s) => s.weight || 0)))} ${wUnit()}`;
  return txt;
}
export function fieldText(f, v) {
  if (f === "minutes") return `${+v} min`;
  if (f === "distance") return `${toD(v)} ${dUnit()}`;
  if (f === "speed") return `${toD(v)} ${sUnit()}`;
  if (f === "incline") return `${+v}% incline`;
  if (f === "resistance") return `level ${+v}`;
  if (f === "floors") return `${+v} floors`;
  if (f === "steps") return `${(+v).toLocaleString()} steps`;
  if (f === "calories") return `${+v} kcal`;
  return String(v);
}
/** All saved days, newest first. */
export const savedDays = () => Object.entries(S.state.days).sort((a, b) => (a[0] < b[0] ? 1 : -1));
/** Minutes of cardio recorded on a day. */
export const cardioMinutes = (d) => (d.items || []).filter((it) => isCardio(itemKind(it)) && !it.actual?.skipped).reduce((s, it) => s + (num(it.actual?.minutes) || 0), 0);
/** Heaviest logged set for an item. */
export const bestWeight = (it) => Math.max(0, ...((it.actual?.sets || []).filter((s) => s.done || num(s.reps) != null).map((s) => num(s.weight) ?? num(it.target?.weight) ?? 0)));
/** Key that links the same exercise across days. */
export const exerciseKey = (it) => it.equipmentId || "n:" + (it.name || "").trim().toLowerCase();

export function remove(list, id) {
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list.splice(i, 1);
  S.state.deleted.push(id);
}
