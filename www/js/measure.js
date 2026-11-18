// Body measurements: add/edit sheet shared by Progress and Profile.
import { S, save, uid, now, today, toW, fromW, wUnit, toLen, fromLen, lenUnit, remove, fmtDay } from "./store.js";
import { esc, icon, sheet, val, confirmBox } from "./ui.js";
import { unitInput } from "./parts.js";

export const MEASURES = [
  ["weight", "Body weight", "w"], ["bodyFat", "Body fat", "%"], ["chest", "Chest", "len"], ["waist", "Waist", "len"],
  ["hips", "Hips", "len"], ["arm", "Arm", "len"], ["thigh", "Thigh", "len"],
];
export const showM = (k, v) => { const u = MEASURES.find((m) => m[0] === k)[2]; return u === "w" ? toW(v) : u === "len" ? toLen(v) : v ?? ""; };
export const unitM = (k) => { const u = MEASURES.find((m) => m[0] === k)[2]; return u === "w" ? wUnit() : u === "len" ? lenUnit() : "%"; };
const readM = (k, v) => { const u = MEASURES.find((m) => m[0] === k)[2]; return v == null ? null : u === "w" ? fromW(v) : u === "len" ? fromLen(v) : +v; };
export const sortedMeasurements = () => [...S.state.measurements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
export const latest = (k) => { const l = sortedMeasurements().filter((m) => m[k] != null); return l[l.length - 1]; };

export function editMeasurement(m, onDone) {
  const isNew = !m;
  const d = m ? { ...m } : { id: uid(), date: today() };
  sheet(`<div class="sheet-head"><h2>${isNew ? "Add measurements" : "Edit measurements"}</h2><button class="btn ghost icon" data-close aria-label="Close">${icon("x")}</button></div>
    <div class="sheet-body">
      <label class="field">Date<input class="input" type="date" name="date" value="${esc(d.date)}" max="${today()}"></label>
      <div class="fields">${MEASURES.map(([k, l]) => `<label class="field">${l}${unitInput(k, showM(k, d[k]), unitM(k))}</label>`).join("")}</div>
      <p class="small muted">Fill in only what you measured.</p>
    </div>
    <div class="sheet-foot">${isNew ? "" : `<button class="btn ghost" data-del style="margin-right:auto;color:var(--missed)">${icon("trash-2")}Delete</button>`}<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>Save</button></div>`, {
    onMount(el, close) {
      el.querySelector("[data-save]").onclick = () => {
        d.date = el.querySelector("[name=date]").value || today();
        for (const [k] of MEASURES) { const v = readM(k, val(el.querySelector(`[name=${k}]`))); if (v == null) delete d[k]; else d[k] = v; }
        d.updatedAt = now();
        if (isNew) S.state.measurements.push(d); else Object.assign(m, d);
        save(); close(); onDone?.();
      };
      el.querySelector("[data-del]")?.addEventListener("click", async () => { close(); if (await confirmBox(`Delete measurements from ${fmtDay(d.date)}?`)) { remove(S.state.measurements, m.id); save(); onDone?.(); } });
    },
  });
}
