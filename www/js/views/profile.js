// Profile: goals, measurements, settings, sync account, backup.
import { S, save, saveNow, now, toW, fromW, wUnit, fmtDay, emptyState } from "../store.js";
import { esc, icon, toast, confirmBox, val } from "../ui.js";
import { photoGet, photoSet, photoKeys } from "../db.js";
import { unitInput } from "../parts.js";
import { editMeasurement, sortedMeasurements, MEASURES, showM, unitM } from "../measure.js";
import { sync, syncEnabled, syncLabel, signIn, signUp, signOut, resetPassword, push, pull } from "../sync.js";

const touchProfile = () => { S.state.profileUpdatedAt = now(); save(); };

export function render(root) {
  const p = S.state.profile, ms = [...sortedMeasurements()].reverse().slice(0, 6);
  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Profile</div><h1>${esc(p.name || "Your profile")}</h1></div></div>
    <div class="grid two">
      <div class="card stack"><h2>Goals</h2>
        <label class="field">Your name<input class="input" data-p="name" value="${esc(p.name)}" placeholder="Name"></label>
        <div class="fields">
          <label class="field">Workouts per week${unitInput("goalPerWeek", p.goalPerWeek, "days", { step: 1 })}</label>
          <label class="field">Target weight${unitInput("targetWeight", toW(p.targetWeight), wUnit())}</label>
        </div>
        <label class="field">Main goal<input class="input" data-p="goalText" value="${esc(p.goalText || "")}" placeholder="e.g. Stronger legs, run 5 km without stopping"></label>
      </div>
      <div class="card stack"><h2>Settings</h2>
        <div class="field">Units<div class="seg"><button class="${p.units === "metric" ? "on" : ""}" data-units="metric">kg, km, cm</button><button class="${p.units === "imperial" ? "on" : ""}" data-units="imperial">lb, mi, in</button></div></div>
        <div class="field">Appearance<div class="seg">${[["system", "Automatic"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => `<button class="${p.theme === k ? "on" : ""}" data-theme="${k}">${l}</button>`).join("")}</div></div>
      </div>
    </div>

    <div class="section card">
      <div class="section-head"><h2>Body measurements</h2><button class="btn small" data-addm>${icon("plus")}Add</button></div>
      ${ms.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Date</th>${MEASURES.map(([k, l]) => `<th>${l} (${unitM(k)})</th>`).join("")}<th></th></tr></thead><tbody>
        ${ms.map((m) => `<tr><td>${esc(fmtDay(m.date, { month: "short", day: "numeric", year: "numeric" }))}</td>${MEASURES.map(([k]) => `<td>${m[k] != null ? esc(showM(k, m[k])) : "–"}</td>`).join("")}<td><button class="btn small ghost icon" data-em="${m.id}" aria-label="Edit">${icon("pencil")}</button></td></tr>`).join("")}</tbody></table></div>
        <a class="link" href="#/progress" style="display:inline-block;margin-top:10px">See charts in Progress</a>`
      : `<div class="empty"><p>Log your weight and measurements to track changes over time.</p></div>`}
    </div>

    <div class="section card stack" id="sync"><h2>Sync across devices</h2>${syncBlock()}</div>

    <div class="section card stack"><h2>Your data</h2>
      <p class="muted">Everything is saved on this device${syncEnabled ? " and, when you are signed in, in your private account" : ""}. A backup file contains your plans, records, equipment and photos.</p>
      <div class="row gap wrap"><button class="btn" data-export>${icon("download")}Download backup</button><button class="btn ghost" data-import>${icon("upload")}Restore from backup</button>
        <button class="btn ghost" data-wipe style="color:var(--missed);margin-left:auto">${icon("trash-2")}Erase this device</button></div>
    </div>`;

  root.querySelectorAll("[data-p]").forEach((el) => el.onchange = () => { p[el.dataset.p] = el.value.trim(); touchProfile(); });
  root.querySelector("[name=goalPerWeek]").onchange = (e) => { p.goalPerWeek = Math.max(1, Math.min(7, Math.round(val(e.target) || 1))); touchProfile(); window.__rerender(); };
  root.querySelector("[name=targetWeight]").onchange = (e) => { p.targetWeight = fromW(val(e.target)); touchProfile(); };
  root.querySelectorAll("[data-units]").forEach((b) => b.onclick = () => { p.units = b.dataset.units; touchProfile(); window.__rerender(); });
  root.querySelectorAll("[data-theme]").forEach((b) => b.onclick = () => { p.theme = b.dataset.theme; touchProfile(); window.__applyTheme(); window.__rerender(); });
  root.querySelector("[data-addm]").onclick = () => editMeasurement(null, () => window.__rerender());
  root.querySelectorAll("[data-em]").forEach((b) => b.onclick = () => editMeasurement(S.state.measurements.find((m) => m.id === b.dataset.em), () => window.__rerender()));
  root.querySelector("[data-export]").onclick = exportBackup;
  root.querySelector("[data-import]").onclick = importBackup;
  root.querySelector("[data-wipe]").onclick = async () => {
    if (!(await confirmBox("Erase all plans, records, equipment and photos on this device?" + (sync.user ? " Your account copy stays in the cloud." : " This cannot be undone without a backup."), { ok: "Erase" }))) return;
    if (sync.user) await signOut();
    indexedDB.deleteDatabase("gym-tracker"); S.state = emptyState(); setTimeout(() => location.replace("#/welcome"), 300); setTimeout(() => location.reload(), 500);
  };
  wireSync(root);
  if (location.hash.endsWith("#sync")) setTimeout(() => document.getElementById("sync")?.scrollIntoView({ behavior: "smooth" }), 50);
}

function syncBlock() {
  if (!syncEnabled) return `<p class="muted">Cloud sync is not switched on in this copy of the app, so your data stays on this device. Use backups to move it.</p>`;
  if (sync.user) return `<div class="row gap wrap"><span class="status ${sync.status === "error" ? "skipped" : "done"}">${icon(sync.status === "error" ? "cloud-alert" : "cloud-check")}${esc(syncLabel())}</span><span class="muted small">Signed in as ${esc(sync.user.email)}</span></div>
    ${sync.error && sync.status === "error" ? `<p class="small" style="color:var(--missed)">${esc(sync.error)}</p>` : ""}
    <div class="row gap wrap"><button class="btn" data-syncnow>${icon("refresh-cw")}Sync now</button><button class="btn ghost" data-signout>Sign out</button></div>`;
  return `<p class="muted">Sign in with the same email on your phone, tablet and computer to see the same plans, records, equipment and photos everywhere.</p>
    <div class="fields" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))"><label class="field">Email<input class="input" type="email" autocomplete="email" data-email></label>
      <label class="field">Password (at least 8 characters)<input class="input" type="password" autocomplete="current-password" data-pass></label></div>
    <div class="row gap wrap"><button class="btn primary" data-signin>Sign in</button><button class="btn" data-signup>Create account</button><button class="btn ghost" data-forgot>Forgot password?</button></div>`;
}
function wireSync(root) {
  const email = () => root.querySelector("[data-email]")?.value.trim(), pass = () => root.querySelector("[data-pass]")?.value;
  const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); } catch (e) { toast(/invalid login/i.test(e.message) ? "Email or password is not correct" : /confirm/i.test(e.message) ? "Confirm your email first, then sign in" : e.message); } window.__rerender(); };
  root.querySelector("[data-signin]")?.addEventListener("click", () => run(() => signIn(email(), pass()), "Signed in. Syncing your data."));
  root.querySelector("[data-signup]")?.addEventListener("click", () => { if ((pass() || "").length < 8) return toast("Password needs at least 8 characters"); run(() => signUp(email(), pass()), (ok) => ok ? "Account created. Your data is syncing." : "Check your email to confirm your address, then sign in."); });
  root.querySelector("[data-forgot]")?.addEventListener("click", () => { if (!email()) return toast("Enter your email first"); run(() => resetPassword(email()), "Check your email for a reset link"); });
  root.querySelector("[data-syncnow]")?.addEventListener("click", () => run(async () => { await pull(); await push(); }, "Synced"));
  root.querySelector("[data-signout]")?.addEventListener("click", async () => { if (await confirmBox("Sign out on this device? Your data stays here and in the cloud.", { ok: "Sign out", danger: false })) run(signOut, "Signed out"); });
}

const blobToData = (b) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function exportBackup() {
  await saveNow();
  const photos = {};
  for (const k of await photoKeys()) { const b = await photoGet(k); if (b) photos[k] = await blobToData(b); }
  const { syncMeta, ...state } = S.state; void syncMeta;
  const blob = new Blob([JSON.stringify({ app: "gym-tracker", exportedAt: now(), state, photos })], { type: "application/json" });
  const name = `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (window.Capacitor?.isNativePlatform?.() && navigator.share) {
    try { await navigator.share({ files: [new File([blob], name, { type: "application/json" })], title: "Gym Tracker backup" }); return; } catch { /* fall back */ }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importBackup() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = async () => {
    try {
      const data = JSON.parse(await inp.files[0].text());
      if (data.app !== "gym-tracker" || !data.state) throw new Error("This is not a Gym Tracker backup.");
      if (!(await confirmBox("Replace what is on this device with the backup?", { ok: "Restore" }))) return;
      for (const [k, d] of Object.entries(data.photos || {})) await photoSet(k, await (await fetch(d)).blob());
      const meta = S.state.syncMeta;
      S.state = { ...emptyState(), ...data.state, syncMeta: { ...meta, dirty: true, pendingPhotos: Object.keys(data.photos || {}) } };
      S.state.profileUpdatedAt = S.state.weekUpdatedAt = now();
      await saveNow(); save(); toast("Backup restored"); window.__applyTheme(); window.__rerender();
    } catch (e) { toast(e.message); }
  };
  inp.click();
}
