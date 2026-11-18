// Equipment library: #/equipment, #/equipment/new, #/equipment/<id>, #/equipment/<id>/edit
import { S, save, uid, now, equip, savedDays, itemName, actualText, exerciseKey, fmtDay, bestWeight, toW, wUnit, remove, targetText, itemKind } from "../store.js";
import { KINDS, MUSCLES, isCardio, kindOf, FIELDS, targetFields } from "../kinds.js";
import { esc, icon, photoImg, pickPhotos, viewPhoto, deletePhoto, confirmBox, toast, paint, val } from "../ui.js";
import { group, photoStrip, wirePhotoStrip, unitInput } from "../parts.js";
import { showField, readField, unitLabel, fromW } from "../store.js";

let filter = { q: "", g: "all" };

export function render(root, args) {
  if (args[0] === "new") return renderEdit(root, null);
  if (args[0] && args[1] === "edit") return renderEdit(root, equip(args[0]));
  if (args[0]) return renderDetail(root, equip(args[0]));
  renderList(root);
}

function card(e) {
  return `<a class="eq-card" href="#/equipment/${e.id}">
    <div class="pic ${group(e.kind)}">${e.photos?.length ? photoImg(e.photos[0], "", e.name) : icon(kindOf(e.kind).icon)}</div>
    ${e.favorite ? `<span class="fav" aria-label="Favourite">${icon("star")}</span>` : ""}
    <div class="body"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.muscles?.length ? e.muscles.join(", ") : kindOf(e.kind).label)}</div></div></a>`;
}
function renderList(root) {
  const q = filter.q.toLowerCase();
  const all = S.state.equipment;
  const list = all.filter((e) => (filter.g === "all" || (filter.g === "fav" ? e.favorite : group(e.kind) === filter.g || (e.muscles || []).includes(filter.g)))
    && (!q || e.name.toLowerCase().includes(q) || (e.muscles || []).some((m) => m.toLowerCase().includes(q)) || (e.instructions || "").toLowerCase().includes(q)))
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name));
  const usedMuscles = MUSCLES.filter((m) => all.some((e) => (e.muscles || []).includes(m)));
  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Equipment</div><h1>My gym</h1></div><a class="btn primary" href="#/equipment/new">${icon("plus")}Add equipment</a></div>
    ${all.length ? `<input class="input" type="search" data-q placeholder="Search machines, muscles, notes" value="${esc(filter.q)}" style="margin-bottom:10px">
    <div class="chips" style="margin-bottom:16px">
      ${[["all", "All"], ["fav", "Favourites"], ["cardio", "Cardio"], ["strength", "Strength"], ...usedMuscles.map((m) => [m, m])].map(([k, l]) => `<button class="chip ${filter.g === k ? "on" : ""}" data-g="${esc(k)}">${k === "fav" ? icon("star") : ""}${esc(l)}</button>`).join("")}
    </div>
    ${list.length ? `<div class="eq-grid">${list.map(card).join("")}</div>` : `<div class="empty">${icon("search")}<p>Nothing matches.</p></div>`}`
    : `<div class="empty">${icon("dumbbell")}<p>Add each machine you use: a photo, what it trains, how to use it and your own settings, like seat height.</p><a class="btn primary" href="#/equipment/new">${icon("plus")}Add your first machine</a></div>`}`;
  const qi = root.querySelector("[data-q]");
  if (qi) qi.oninput = () => { filter.q = qi.value; const pos = qi.selectionStart; window.__rerender().then(() => { const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); }); };
  root.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { filter.g = b.dataset.g; window.__rerender(); });
}

/** Past records of this machine, newest first. */
function history(e) {
  const out = [];
  for (const [date, d] of savedDays()) for (const it of d.items || []) if (exerciseKey(it) === e.id && actualText(it) && !it.actual?.skipped) out.push({ date, it });
  return out;
}
function renderDetail(root, e) {
  if (!e) { root.innerHTML = `<div class="empty">${icon("circle-help")}<p>This equipment was removed.</p><a class="btn" href="#/equipment">Back to equipment</a></div>`; return; }
  const h = history(e), cardio = isCardio(e.kind);
  const best = !cardio && h.length ? Math.max(...h.map((x) => bestWeight(x.it))) : 0;
  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow"><a class="link" href="#/equipment">${icon("chevron-left")} Equipment</a></div><h1>${esc(e.name)}</h1></div>
      <div class="row gap"><button class="btn icon ${e.favorite ? "volt" : ""}" data-fav aria-pressed="${!!e.favorite}" aria-label="Favourite">${icon("star")}</button><a class="btn" href="#/equipment/${e.id}/edit">${icon("pencil")}Edit</a></div></div>
    <div class="eq-hero">
      <div>
        <div class="gallery-main">${e.photos?.length ? photoImg(e.photos[0], "", e.name) : icon(kindOf(e.kind).icon)}</div>
        ${photoStrip(e.photos || [], "eq", { label: "Add photo of this machine" })}
      </div>
      <div class="stack">
        <div class="row wrap gap"><span class="tag ${group(e.kind)}">${icon(kindOf(e.kind).icon)}${esc(kindOf(e.kind).label)}</span>${(e.muscles || []).map((m) => `<span class="tag">${esc(m)}</span>`).join("")}</div>
        ${e.settings ? `<div class="card flat"><h3 style="margin-bottom:6px">My settings</h3><p class="pre">${esc(e.settings)}</p></div>` : ""}
        ${e.instructions ? `<div class="card flat"><h3 style="margin-bottom:6px">How to use</h3><p class="pre">${esc(e.instructions)}</p></div>` : ""}
        ${e.defaultTarget && Object.keys(e.defaultTarget).length ? `<div class="card flat"><h3 style="margin-bottom:6px">Usual target</h3><p>${esc(targetText({ kind: e.kind, target: e.defaultTarget }))}</p></div>` : ""}
        ${!e.settings && !e.instructions ? `<p class="muted">No settings or instructions yet. <a class="link" href="#/equipment/${e.id}/edit">Add them</a></p>` : ""}
        <div class="grid tiles" style="grid-template-columns:1fr 1fr">
          <div class="tile"><div class="label">Times used</div><div class="value num">${h.length}</div></div>
          <div class="tile"><div class="label">${cardio ? "Last used" : "Heaviest set"}</div><div class="value num" style="font-size:22px">${cardio ? (h[0] ? esc(fmtDay(h[0].date, { month: "short", day: "numeric" })) : "–") : best ? `${toW(best)}<small>${wUnit()}</small>` : "–"}</div></div>
        </div>
      </div>
    </div>
    <div class="section"><div class="section-head"><h2>History</h2></div>
      ${h.length ? `<div class="list">${h.slice(0, 30).map(({ date, it }) => `<a class="list-item" href="#/workout/${date}"><div class="main"><div class="t num">${esc(actualText(it))}</div><div class="s">${esc(fmtDay(date))} · target ${esc(targetText(it))}</div></div>${icon("chevron-right", "muted")}</a>`).join("")}</div>`
      : `<div class="empty"><p>No workouts recorded on this machine yet.</p></div>`}
    </div>`;
  root.querySelector("[data-fav]").onclick = () => { e.favorite = !e.favorite; e.updatedAt = now(); save(); window.__rerender(); };
  root.querySelector(".gallery-main img")?.addEventListener("click", () => viewPhoto(e.photos[0], e.name));
  wirePhotoStrip(root, "eq", e.photos ||= [], () => { e.updatedAt = now(); save(); window.__rerender(); });
}

function renderEdit(root, e) {
  const isNew = !e;
  const draft = e ? structuredClone(e) : { id: uid(), name: "", kind: "machine", muscles: [], instructions: "", settings: "", favorite: false, photos: [], defaultTarget: {} };
  const draw = () => {
    const cardio = isCardio(draft.kind), t = draft.defaultTarget || {};
    root.innerHTML = `
      <div class="page-head"><div><div class="eyebrow"><a class="link" href="${isNew ? "#/equipment" : "#/equipment/" + draft.id}">${icon("chevron-left")} ${isNew ? "Equipment" : esc(draft.name)}</a></div><h1>${isNew ? "Add equipment" : "Edit equipment"}</h1></div></div>
      <div class="eq-hero">
        <div class="card stack">
          <h3>Photos</h3>
          <div class="row gap wrap"><button class="btn" data-cam>${icon("camera")}Take photo</button><button class="btn ghost" data-lib>${icon("image")}Choose from library</button></div>
          ${photoStrip(draft.photos, "draft", { add: false })}
          <p class="small muted">The first photo is the cover.</p>
        </div>
        <div class="card stack">
          <label class="field">Name<input class="input" data-f="name" value="${esc(draft.name)}" placeholder="e.g. Hip thrust machine" ${isNew ? "autofocus" : ""}></label>
          <label class="field">Type<select class="input" data-f="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === draft.kind ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
          <div class="field">Muscles it trains<div class="muscle-pick">${MUSCLES.map((m) => `<button type="button" class="chip ${draft.muscles.includes(m) ? "on" : ""}" data-m="${esc(m)}" aria-pressed="${draft.muscles.includes(m)}">${esc(m)}</button>`).join("")}</div></div>
        </div>
      </div>
      <div class="grid two section">
        <div class="card stack"><label class="field">My settings<textarea class="input" data-f="settings" placeholder="e.g. Seat 4, back pad 2, start at 40 kg">${esc(draft.settings)}</textarea></label>
          <label class="field">How to use<textarea class="input" data-f="instructions" placeholder="Steps or cues you want to remember">${esc(draft.instructions)}</textarea></label></div>
        <div class="card stack"><h3>Usual target</h3><p class="small muted" style="margin-top:-6px">Filled in when you add this machine to a plan.</p>
          <div class="fields">${cardio ? targetFields(draft.kind).map((f) => `<label class="field">${FIELDS[f].label}${unitInput("t_" + f, showField(f, t[f]), unitLabel(FIELDS[f].unit))}</label>`).join("")
            : `<label class="field">Sets${unitInput("t_sets", t.sets, "sets", { step: 1 })}</label><label class="field">Reps${unitInput("t_reps", t.reps, "reps", { step: 1 })}</label><label class="field">Weight${unitInput("t_weight", toW(t.weight), wUnit())}</label>`}</div>
          <label class="row" style="font-weight:600;margin-top:4px"><input type="checkbox" data-f="favorite" ${draft.favorite ? "checked" : ""}> Favourite</label></div>
      </div>
      <div class="row gap wrap" style="margin-top:18px">
        <button class="btn primary" data-save style="min-width:140px">${isNew ? "Add equipment" : "Save"}</button>
        <a class="btn ghost" href="${isNew ? "#/equipment" : "#/equipment/" + draft.id}">Cancel</a>
        ${isNew ? "" : `<button class="btn ghost" data-del style="margin-left:auto;color:var(--missed)">${icon("trash-2")}Delete</button>`}
      </div>`;
    paint(root);
    const read = () => {
      root.querySelectorAll("[data-f]").forEach((el) => { draft[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; });
      const nt = {};
      root.querySelectorAll("[name^=t_]").forEach((el) => { const f = el.name.slice(2); const v = f === "weight" ? fromW(val(el)) : ["sets", "reps"].includes(f) ? val(el) : readField(f, val(el)); if (v != null) nt[f] = v; });
      draft.defaultTarget = nt;
    };
    root.querySelector("[data-f=kind]").onchange = () => { read(); draft.defaultTarget = {}; draw(); };
    root.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { const m = b.dataset.m; const i = draft.muscles.indexOf(m); i >= 0 ? draft.muscles.splice(i, 1) : draft.muscles.push(m); b.classList.toggle("on"); b.setAttribute("aria-pressed", i < 0); });
    const add = async (camera) => { read(); const ids = await pickPhotos({ camera }); draft.photos.push(...ids); draw(); };
    root.querySelector("[data-cam]").onclick = () => add(true);
    root.querySelector("[data-lib]").onclick = () => add(false);
    wirePhotoStrip(root, "draft", draft.photos, () => { read(); draw(); }, { keepFiles: true });
    root.querySelector("[data-save]").onclick = () => {
      read();
      draft.name = draft.name.trim();
      if (!draft.name) { toast("Give it a name"); root.querySelector("[data-f=name]").focus(); return; }
      draft.updatedAt = now();
      if (isNew) { draft.createdAt = now(); S.state.equipment.push(draft); }
      else Object.assign(e, draft);
      save(); toast(isNew ? "Added to your equipment" : "Saved");
      location.hash = "#/equipment/" + draft.id;
    };
    root.querySelector("[data-del]")?.addEventListener("click", async () => {
      if (!(await confirmBox(`Delete ${draft.name}? Past workouts keep their records.`))) return;
      // Keep the name on past items so history still reads well.
      for (const d of Object.values(S.state.days)) for (const it of d.items) if (it.equipmentId === e.id) { it.name = e.name; it.kind = e.kind; it.equipmentId = null; }
      for (const w of Object.values(S.state.week)) for (const it of w.items) if (it.equipmentId === e.id) { it.name = e.name; it.kind = e.kind; it.equipmentId = null; }
      for (const p of e.photos || []) await deletePhoto(p);
      remove(S.state.equipment, e.id); save(); toast("Deleted"); location.hash = "#/equipment";
    });
  };
  draw();
}
void itemName; void itemKind;
