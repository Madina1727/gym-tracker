// Pieces shared by several views: exercise editor, planned-vs-actual rows, photo strips, icons.
import { S, equip, itemName, itemKind, targetText, actualText, status, newItem, toW, fromW, wUnit, showField, readField, unitLabel, save, uid, now } from "./store.js";
import { KINDS, FIELDS, isCardio, kindOf, targetFields } from "./kinds.js";
import { esc, icon, sheet, photoImg, val, pickPhotos, viewPhoto, deletePhoto, paint } from "./ui.js";

export const group = (kind) => (isCardio(kind) ? "cardio" : "strength");
export function kindIcon(kind) { return `<span class="kind-ic ${group(kind)}">${icon(kindOf(kind).icon)}</span>`; }
/** Equipment photo if there is one, else the kind icon. */
export function itemThumb(it) {
  const e = it.equipmentId && equip(it.equipmentId);
  if (e?.photos?.length) return photoImg(e.photos[0], "thumb", e.name);
  return kindIcon(itemKind(it));
}
const ST = { done: ["circle-check", "Completed"], "done-short": ["circle-check", "Done, below target"], partial: ["circle-dashed", "In progress"], skipped: ["circle-x", "Not completed"], todo: ["circle", "Not started"] };
export function statusBadge(it, { past = false } = {}) {
  let s = status(it);
  let [ic, label] = ST[s];
  if (s === "todo" && past) { s = "skipped"; [ic, label] = ["circle-x", "Not completed"]; }
  return `<span class="status ${s}">${icon(ic)}${label}</span>`;
}
export function pvaRows(items, { past = false, link = "" } = {}) {
  if (!items.length) return "";
  return `<div class="pva">${items.map((it) => {
    const a = actualText(it);
    return `<div class="pva-row">${itemThumb(it)}<div class="main"><div class="name">${esc(itemName(it))}</div><div class="target">Target: ${esc(targetText(it))}</div></div>
      <div class="actual">${a && a !== "Skipped" ? `<div class="num">${esc(a)}</div>` : ""}${statusBadge(it, { past })}</div></div>`;
  }).join("")}</div>${link}`;
}

/* ---------- unit input ---------- */
export function unitInput(name, value, unit, { step = "any", placeholder = "" } = {}) {
  return `<div class="input unit-wrap"><input type="number" inputmode="decimal" step="${step}" min="0" name="${name}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}"><span>${esc(unit)}</span></div>`;
}

/* ---------- target form (plan) ---------- */
function targetForm(kind, t = {}) {
  if (isCardio(kind)) {
    return `<div class="fields">${targetFields(kind).map((f) => `<label class="field">${FIELDS[f].label}${unitInput("t_" + f, showField(f, t[f]), unitLabel(FIELDS[f].unit))}</label>`).join("")}</div>
      <p class="small muted">Fill in only what you aim for, for example just the time.</p>`;
  }
  return `<div class="fields">
    <label class="field">Sets${unitInput("t_sets", t.sets, "sets", { step: 1 })}</label>
    <label class="field">Reps${unitInput("t_reps", t.reps, "reps", { step: 1 })}</label>
    <label class="field">Weight${unitInput("t_weight", toW(t.weight), wUnit())}</label>
  </div>`;
}
function readTarget(el, kind) {
  const t = {};
  if (isCardio(kind)) targetFields(kind).forEach((f) => { const v = readField(f, val(el.querySelector(`[name=t_${f}]`))); if (v != null) t[f] = v; });
  else {
    const s = val(el.querySelector("[name=t_sets]")), r = val(el.querySelector("[name=t_reps]")), w = fromW(val(el.querySelector("[name=t_weight]")));
    if (s != null) t.sets = s; if (r != null) t.reps = r; if (w != null) t.weight = w;
  }
  return t;
}

/** Add or edit one exercise in a plan. Calls onSave(item) with a new or updated item. */
export function editItem(item, onSave, { onDelete } = {}) {
  const editing = !!item;
  let it = item ? structuredClone(item) : newItem();
  let step = editing || it.equipmentId ? "target" : "pick";
  let query = "";
  const close = sheet(`<div class="sheet-head"><h2>${editing ? "Edit exercise" : "Add exercise"}</h2><button class="btn ghost icon" data-close aria-label="Close">${icon("x")}</button></div><div data-body></div>`, {
    onMount(el, closeFn) {
      const body = el.querySelector("[data-body]");
      const draw = () => {
        if (step === "pick") {
          const list = S.state.equipment.filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()) || (e.muscles || []).some((m) => m.toLowerCase().includes(query.toLowerCase())))
            .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name));
          body.innerHTML = `<div class="sheet-body">
            <input class="input" type="search" placeholder="Search your equipment or muscle" value="${esc(query)}" data-q autofocus>
            ${list.length ? `<div class="list">${list.map((e) => `<button class="list-item" data-eq="${e.id}">${e.photos?.length ? photoImg(e.photos[0], "thumb") : kindIcon(e.kind)}
              <div class="main"><div class="t">${esc(e.name)}${e.favorite ? " " + icon("star", "fav-ic") : ""}</div><div class="s">${esc(kindOf(e.kind).label)}${e.muscles?.length ? " · " + esc(e.muscles.join(", ")) : ""}</div></div>${icon("chevron-right", "muted")}</button>`).join("")}</div>`
              : `<div class="empty">${icon("dumbbell")}<p>${S.state.equipment.length ? "Nothing matches." : "Your equipment library is empty."}</p></div>`}
            <div class="section-head" style="margin-top:6px"><h3>Or add an exercise without a machine</h3></div>
            <div class="row gap wrap">
              <input class="input" style="flex:2;min-width:180px" placeholder="Exercise name, e.g. Plank" data-name value="${esc(query)}">
              <select class="input" style="flex:1;min-width:150px" data-kind>${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === "bodyweight" ? "selected" : ""}>${v.label}</option>`).join("")}</select>
              <button class="btn primary" data-custom>Next</button>
            </div></div>`;
          paint(body);
          const q = body.querySelector("[data-q]");
          q.oninput = () => { query = q.value; const pos = q.selectionStart; draw(); const n = body.querySelector("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); };
          body.querySelectorAll("[data-eq]").forEach((b) => b.onclick = () => { const e = equip(b.dataset.eq); it.equipmentId = e.id; it.kind = e.kind; it.name = e.name; it.target = { ...(e.defaultTarget || {}) }; step = "target"; draw(); });
          body.querySelector("[data-custom]").onclick = () => {
            const name = body.querySelector("[data-name]").value.trim();
            if (!name) { body.querySelector("[data-name]").focus(); return; }
            it.equipmentId = null; it.name = name; it.kind = body.querySelector("[data-kind]").value; step = "target"; draw();
          };
        } else {
          const kind = itemKind(it);
          body.innerHTML = `<div class="sheet-body">
            <div class="row gap">${itemThumb(it)}<div class="main" style="flex:1"><div style="font-weight:700">${esc(itemName(it))}</div><div class="small muted">${esc(kindOf(kind).label)}</div></div>
              ${editing ? "" : `<button class="btn small ghost" data-change>Change</button>`}</div>
            ${!it.equipmentId ? `<label class="field">Name<input class="input" name="name" value="${esc(it.name)}"></label>` : ""}
            <div><h3 style="margin-bottom:8px">Target</h3>${targetForm(kind, it.target)}</div>
            <label class="field">Note for this exercise (optional)<input class="input" name="note" value="${esc(it.planNote || "")}" placeholder="e.g. slow on the way down"></label>
          </div>
          <div class="sheet-foot">${editing && onDelete ? `<button class="btn ghost" data-del style="color:var(--missed);margin-right:auto">${icon("trash-2")}Remove</button>` : ""}<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>${editing ? "Save" : "Add to plan"}</button></div>`;
          paint(body);
          body.querySelector("[data-change]")?.addEventListener("click", () => { step = "pick"; draw(); });
          body.querySelector("[data-del]")?.addEventListener("click", () => { onDelete(); closeFn(); });
          body.querySelector("[data-save]").onclick = () => {
            it.target = readTarget(body, kind);
            const n = body.querySelector("[name=name]"); if (n) it.name = n.value.trim() || it.name;
            it.planNote = body.querySelector("[name=note]").value.trim();
            onSave(it); closeFn();
          };
        }
      };
      draw();
    },
  });
  return close;
}

/* ---------- photo strip ---------- */
/** Renders photos with remove buttons and an add button. Handlers are wired by wirePhotoStrip. */
export function photoStrip(ids = [], key, { add = true, label = "Add photo" } = {}) {
  return `<div class="photo-strip" data-strip="${esc(key)}">${ids.map((id) => `<div class="ph">${photoImg(id, "", "Photo")}<button class="x" data-rm="${esc(id)}" aria-label="Remove photo">${icon("x")}</button></div>`).join("")}
    ${add ? `<button class="add-photo" data-add aria-label="${esc(label)}">${icon("camera")}</button>` : ""}</div>`;
}
/** list is the photo id array, or a function returning it (so nothing is created until the user acts). */
export function wirePhotoStrip(root, key, listOrFn, onChange, { keepFiles = false } = {}) {
  const list = () => (typeof listOrFn === "function" ? listOrFn() : listOrFn);
  const strip = root.querySelector(`[data-strip="${CSS.escape(key)}"]`);
  if (!strip) return;
  strip.querySelector("[data-add]")?.addEventListener("click", async () => { const ids = await pickPhotos({ camera: false }); if (ids.length) { list().push(...ids); onChange(); } });
  strip.querySelectorAll("img[data-photo]").forEach((img) => img.onclick = () => viewPhoto(img.dataset.photo));
  strip.querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => { const l = list(), i = l.indexOf(b.dataset.rm); if (i >= 0) l.splice(i, 1); if (!keepFiles) await deletePhoto(b.dataset.rm); onChange(); });
}
export { uid, now, save };
