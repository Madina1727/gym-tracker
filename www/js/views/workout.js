// Workout: record what you actually did, exercise by exercise (#/workout/<date>).
import { S, save, today, getDay, ensureDay, touch, itemName, itemKind, targetText, actualText, status, dayProgress, fmtDay, toW, fromW, wUnit, showField, readField, unitLabel, now } from "../store.js";
import { FIELDS, isCardio, kindOf } from "../kinds.js";
import { esc, icon, paint, confirmBox, toast, val } from "../ui.js";
import { editItem, itemThumb, statusBadge, unitInput, photoStrip, wirePhotoStrip } from "../parts.js";

let tick;
const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

function setRows(it) {
  const t = it.target || {}, sets = it.actual.sets;
  const n = Math.max(sets.length, +t.sets || 0, 1);
  while (sets.length < n) sets.push({ reps: null, weight: null, done: false });
  return `<div class="sets"><div class="set-row"><span class="hdr" style="text-align:center">Set</span><span class="hdr">Reps</span><span class="hdr">Weight (${wUnit()})</span><span></span></div>
    ${sets.map((s, i) => `<div class="set-row" data-set="${i}"><span class="n">${i + 1}</span>
      <input class="input" type="number" inputmode="numeric" min="0" step="1" data-k="reps" value="${esc(s.reps ?? "")}" placeholder="${esc(t.reps ?? "")}" aria-label="Set ${i + 1} reps">
      <input class="input" type="number" inputmode="decimal" min="0" step="any" data-k="weight" value="${esc(toW(s.weight))}" placeholder="${esc(toW(t.weight))}" aria-label="Set ${i + 1} weight">
      <button class="check ${s.done ? "on" : ""}" data-check aria-pressed="${s.done}" aria-label="Set ${i + 1} done">${icon("check")}</button></div>`).join("")}</div>
    <div class="row gap"><button class="btn small" data-addset>${icon("plus")}Add set</button>${sets.length > 1 ? `<button class="btn small ghost" data-rmset>Remove last set</button>` : ""}</div>`;
}
function cardioFields(it) {
  const k = itemKind(it), t = it.target || {}, a = it.actual;
  return `<div class="fields">${kindOf(k).fields.map((f) => `<label class="field">${FIELDS[f].label}${unitInput("a_" + f, showField(f, a[f]), unitLabel(FIELDS[f].unit), { placeholder: showField(f, t[f]) })}</label>`).join("")}</div>`;
}
function exCard(it, i, open, past) {
  const k = itemKind(it), st = status(it);
  return `<div class="ex ${open ? "open" : ""} st-${st}" data-ex="${i}">
    <button class="ex-head" data-toggle aria-expanded="${open}">${itemThumb(it)}<div class="main"><div class="t">${esc(itemName(it))}</div><div class="s" data-sum>${esc(actualText(it) || "Target: " + targetText(it))}</div></div>
      <span data-st>${statusBadge(it, { past })}</span>${icon("chevron-down", "chev")}</button>
    <div class="ex-body">
      <div class="ex-target">${icon("target")}<span>Target: <b>${esc(targetText(it))}</b>${it.planNote ? ` · ${esc(it.planNote)}` : ""}</span></div>
      ${isCardio(k) ? cardioFields(it) : setRows(it)}
      <label class="field" style="margin-top:12px">Note<input class="input" data-note value="${esc(it.actual.note || "")}" placeholder="How did it feel? Machine settings?"></label>
      <div class="small muted" style="margin-top:12px;font-weight:600">Photos of the screen or result</div>
      ${photoStrip(it.actual.photos, "ex" + i)}
      <div class="ex-actions">
        ${(isCardio(k) || !(+it.target?.sets)) && (it.done || st !== "done") ? `<button class="btn small ${it.done ? "volt" : ""}" data-done>${icon("check")}${it.done ? "Marked done" : "Mark done"}</button>` : ""}
        <button class="btn small ${it.actual.skipped ? "danger" : "ghost"}" data-skip>${icon("circle-x")}${it.actual.skipped ? "Not completed" : "Didn't do it"}</button>
        <button class="btn small ghost" data-edit>${icon("pencil")}Edit target</button>
      </div>
    </div></div>`;
}

export function render(root, args) {
  clearInterval(tick);
  const date = args[0] || today();
  const d = getDay(date), t = today(), past = date < t, isToday = date === t;
  if (!d.items.length) {
    root.innerHTML = `<div class="page-head"><div><div class="eyebrow">Workout · ${esc(fmtDay(date))}</div><h1>${d.rest ? "Rest day" : "No workout planned"}</h1></div></div>
      <div class="empty">${icon("timer")}<p>Add exercises to ${isToday ? "today" : "this date"}, then record your results here.</p><div class="row gap" style="justify-content:center"><button class="btn primary" data-add>${icon("plus")}Add exercise</button><a class="btn" href="#/plan">Weekly plan</a></div></div>`;
    root.querySelector("[data-add]").onclick = () => editItem(null, (it) => { const x = ensureDay(date); x.items.push(it); touch(x); save(); window.__rerender(); });
    return;
  }
  const own = () => ensureDay(date);
  const p = dayProgress(d);
  const firstOpen = d.items.findIndex((it) => status(it) === "todo" || status(it) === "partial");
  const openSet = render.open?.date === date ? render.open.set : new Set([firstOpen < 0 ? -1 : firstOpen]);
  render.open = { date, set: openSet };

  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">${isToday ? "Today" : esc(fmtDay(date))}</div><h1>${esc(d.title || "Workout")}</h1></div>
      <a class="btn small ghost" href="#/day/${date}">${icon("list")}Plan</a></div>
    <div class="wk-head">
      <div style="flex:1;min-width:0">
        <div class="row between"><div><div class="timer" data-timer>${d.startedAt ? fmtClock((d.finishedAt ? new Date(d.finishedAt) : new Date()) - new Date(d.startedAt)) : "0:00"}</div>
          <div class="sub">${d.finishedAt ? "Finished" : d.startedAt ? "In progress" : isToday ? "Not started" : "Recording results"}</div></div>
          <div style="text-align:right"><div class="timer num" data-count>${p.done}/${p.total}</div><div class="sub">completed</div></div></div>
        <div class="bar"><i data-bar style="width:${Math.round(p.pct * 100)}%"></i></div>
      </div>
    </div>
    ${isToday && !d.startedAt ? `<button class="btn volt block" data-start style="margin-bottom:14px;height:48px">${icon("play")}Start workout</button>` : ""}
    <div data-list>${d.items.map((it, i) => exCard(it, i, openSet.has(i), past)).join("")}</div>
    <button class="btn block" data-add style="margin-top:4px">${icon("plus")}Add an exercise</button>
    <div class="section card">
      <h2 style="margin-bottom:10px">Workout notes and photos</h2>
      <textarea class="input" data-daynote placeholder="Energy, how the session went, anything to remember">${esc(d.note || "")}</textarea>
      ${photoStrip(d.photos || [], "day")}
    </div>
    <div class="row gap wrap" style="margin-top:16px">
      ${d.startedAt && !d.finishedAt ? `<button class="btn primary" data-finish style="flex:1;height:48px">${icon("flag")}Finish workout</button>` : ""}
      ${d.finishedAt ? `<button class="btn ghost" data-reopen>${icon("rotate-ccw")}Resume timer</button>` : ""}
    </div>`;

  const startIfNeeded = () => {
    const x = own();
    if (!isToday || x.startedAt) return;
    x.startedAt = now();
    root.querySelector("[data-start]")?.remove();
    const sub = root.querySelector(".wk-head .sub"); if (sub) sub.textContent = "In progress";
    startTick(x.startedAt);
  };
  const refresh = (i) => {
    const x = own(), it = x.items[i], card = root.querySelector(`[data-ex="${i}"]`);
    touch(x); save();
    card.querySelector("[data-sum]").textContent = actualText(it) || "Target: " + targetText(it);
    card.querySelector("[data-st]").innerHTML = statusBadge(it, { past }); paint(card.querySelector("[data-st]"));
    card.className = card.className.replace(/st-\S+/, "st-" + status(it));
    const pp = dayProgress(x);
    root.querySelector("[data-count]").textContent = `${pp.done}/${pp.total}`;
    root.querySelector("[data-bar]").style.width = Math.round(pp.pct * 100) + "%";
  };
  const redraw = () => { save(); window.__rerender(); };

  root.querySelectorAll("[data-ex]").forEach((card) => {
    const i = +card.dataset.ex;
    const item = () => own().items[i];
    const getSet = (si) => { const sets = item().actual.sets; while (sets.length <= si) sets.push({ reps: null, weight: null, done: false }); return sets[si]; };
    card.querySelector("[data-toggle]").onclick = () => { card.classList.toggle("open"); openSet[card.classList.contains("open") ? "add" : "delete"](i); card.querySelector("[data-toggle]").setAttribute("aria-expanded", card.classList.contains("open")); };
    card.querySelectorAll("[name^=a_]").forEach((inp) => inp.oninput = () => { startIfNeeded(); const f = inp.name.slice(2); const v = readField(f, val(inp)); if (v == null) delete item().actual[f]; else item().actual[f] = v; refresh(i); });
    card.querySelectorAll("[data-set]").forEach((row) => {
      const si = +row.dataset.set;
      row.querySelectorAll("input").forEach((inp) => inp.oninput = () => { startIfNeeded(); const s = getSet(si); s[inp.dataset.k] = inp.dataset.k === "weight" ? fromW(val(inp)) : val(inp); refresh(i); });
      row.querySelector("[data-check]").onclick = (e) => {
        startIfNeeded();
        const it = item(), s = getSet(si); s.done = !s.done;
        if (s.done) { if (s.reps == null && it.target.reps != null) s.reps = +it.target.reps; if (s.weight == null && it.target.weight != null) s.weight = +it.target.weight; }
        row.querySelector("[data-k=reps]").value = s.reps ?? ""; row.querySelector("[data-k=weight]").value = toW(s.weight);
        e.currentTarget.classList.toggle("on", s.done); e.currentTarget.setAttribute("aria-pressed", s.done);
        refresh(i);
      };
    });
    card.querySelector("[data-addset]")?.addEventListener("click", () => { getSet(Math.max(0, card.querySelectorAll("[data-set]").length - 1)); const sets = item().actual.sets, last = sets[sets.length - 1] || {}; sets.push({ reps: null, weight: last.weight ?? null, done: false }); redraw(); });
    card.querySelector("[data-rmset]")?.addEventListener("click", () => { getSet(card.querySelectorAll("[data-set]").length - 1); item().actual.sets.pop(); redraw(); });
    card.querySelector("[data-note]").onchange = (e) => { item().actual.note = e.target.value.trim(); touch(own()); save(); };
    card.querySelector("[data-done]")?.addEventListener("click", () => { startIfNeeded(); const it = item(); it.done = !it.done; if (it.done) it.actual.skipped = false; redraw(); });
    card.querySelector("[data-skip]").onclick = () => { const it = item(); it.actual.skipped = !it.actual.skipped; if (it.actual.skipped) it.done = false; redraw(); };
    card.querySelector("[data-edit]").onclick = () => editItem(item(), (it) => { const x = own(); x.items[i] = { ...x.items[i], ...it }; redraw(); }, { onDelete: () => { own().items.splice(i, 1); openSet.clear(); redraw(); } });
    wirePhotoStrip(card, "ex" + i, () => own().items[i].actual.photos, () => { touch(own()); redraw(); });
  });
  root.querySelector("[data-start]")?.addEventListener("click", () => { own().startedAt = now(); redraw(); });
  root.querySelector("[data-add]").onclick = () => editItem(null, (it) => { const x = own(); x.items.push(it); openSet.add(x.items.length - 1); redraw(); });
  root.querySelector("[data-daynote]").onchange = (e) => { const x = own(); x.note = e.target.value.trim(); touch(x); save(); };
  wirePhotoStrip(root, "day", () => (own().photos ||= []), () => { touch(own()); redraw(); });
  root.querySelector("[data-finish]")?.addEventListener("click", async () => {
    const x = own(), pp = dayProgress(x);
    if (pp.done < pp.total && !(await confirmBox(`${pp.total - pp.done} exercise${pp.total - pp.done === 1 ? " is" : "s are"} not completed. Finish anyway?`, { ok: "Finish", danger: false }))) return;
    x.finishedAt = now(); touch(x); save(); toast(`Workout saved · ${pp.done}/${pp.total} completed`); location.hash = "#/";
  });
  root.querySelector("[data-reopen]")?.addEventListener("click", () => { const x = own(); x.finishedAt = null; redraw(); });

  function startTick(at) { clearInterval(tick); tick = setInterval(() => { const el = document.querySelector("[data-timer]"); if (!el) return clearInterval(tick); el.textContent = fmtClock(Date.now() - new Date(at)); }, 1000); }
  if (d.startedAt && !d.finishedAt) startTick(d.startedAt);
}
