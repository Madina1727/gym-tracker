// My Plan: weekly templates (#/plan, #/plan/week/<0-6>), calendar (#/plan/month/<YYYY-MM>), and one date (#/day/<date>).
import { S, save, today, weekday, WEEKDAYS, MON_FIRST, getDay, ensureDay, touch, itemName, targetText, fmtDay, addDays, parseDay, iso, dayProgress, itemKind, newItem } from "../store.js";
import { esc, icon, confirmBox, toast } from "../ui.js";
import { editItem, itemThumb, pvaRows } from "../parts.js";
import { dayState } from "./home.js";
import { kindOf } from "../kinds.js";

const rr = () => window.__rerender();

function itemsEditor(items, onChange) {
  if (!items.length) return `<div class="empty">${icon("list-plus")}<p>No exercises yet.</p></div>`;
  return `<div class="list">${items.map((it, i) => `<div class="plan-item">
      <div class="order"><button data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up">${icon("chevron-up")}</button><button data-down="${i}" ${i === items.length - 1 ? "disabled" : ""} aria-label="Move down">${icon("chevron-down")}</button></div>
      ${itemThumb(it)}
      <div class="main"><div style="font-weight:650">${esc(itemName(it))}</div><div class="small muted">${kindOf(itemKind(it)).label !== itemName(it) ? esc(kindOf(itemKind(it)).label) + " · " : ""}Target: ${esc(targetText(it))}</div></div>
      <button class="btn small ghost icon" data-edit="${i}" aria-label="Edit">${icon("pencil")}</button></div>`).join("")}</div>`;
}
/** getItems() returns the live array (for a date it makes the date's own copy first; order is the same). */
function wireItems(root, getItems, onChange) {
  root.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => { const items = getItems(); const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; onChange(); });
  root.querySelectorAll("[data-down]").forEach((b) => b.onclick = () => { const items = getItems(); const i = +b.dataset.down; [items[i + 1], items[i]] = [items[i], items[i + 1]]; onChange(); });
  root.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => {
    const i = +b.dataset.edit;
    editItem(getItems()[i], (it) => { const items = getItems(); items[i] = { ...items[i], ...it }; onChange(); }, { onDelete: () => { getItems().splice(i, 1); onChange(); } });
  });
}
export function render(root, args, path) {
  if (path === "day") return renderDay(root, args[0] || today());
  const mode = args[0] === "month" ? "month" : "week";
  root.innerHTML = `<div class="page-head"><div><div class="eyebrow">My Plan</div><h1>${mode === "week" ? "Weekly schedule" : "Calendar"}</h1></div>
    <div class="seg" role="tablist"><button class="${mode === "week" ? "on" : ""}" data-mode="week">Week</button><button class="${mode === "month" ? "on" : ""}" data-mode="month">Calendar</button></div></div><div data-c></div>`;
  root.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => location.hash = b.dataset.mode === "week" ? "#/plan" : "#/plan/month");
  const c = root.querySelector("[data-c]");
  mode === "week" ? renderWeek(c, args[1] != null ? +args[1] : weekday(today())) : renderMonth(c, args[1] || today().slice(0, 7));
}

function renderWeek(root, wd) {
  const tpl = S.state.week[wd];
  root.innerHTML = `
    <p class="muted" style="margin:-6px 0 14px">This repeats every week. Changing one date in the calendar does not change the weekly schedule.</p>
    <div class="day-tabs">${MON_FIRST.map((d) => { const x = S.state.week[d]; return `<button class="${d === wd ? "on" : ""}" data-wd="${d}">${WEEKDAYS[d].slice(0, 3)}<small>${x.rest ? "Rest" : x.items.length ? x.items.length + " ex" : "–"}</small></button>`; }).join("")}</div>
    <div class="card">
      <div class="row between wrap gap" style="margin-bottom:12px"><h2>${WEEKDAYS[wd]}</h2>
        <label class="row small" style="font-weight:600;cursor:pointer"><input type="checkbox" data-rest ${tpl.rest ? "checked" : ""}> Rest day</label></div>
      <label class="field" style="margin-bottom:14px">Workout name<input class="input" data-title value="${esc(tpl.title)}" placeholder="e.g. Lower body + cardio"></label>
      <div data-items>${itemsEditor(tpl.items)}</div>
      <div class="row gap wrap" style="margin-top:12px">
        <button class="btn primary" data-add>${icon("plus")}Add exercise</button>
        <button class="btn ghost" data-copy>${icon("copy")}Copy to another day</button>
      </div>
    </div>`;
  const changed = () => { S.state.weekUpdatedAt = new Date().toISOString(); save(); rr(); };
  root.querySelectorAll("[data-wd]").forEach((b) => b.onclick = () => location.hash = `#/plan/week/${b.dataset.wd}`);
  root.querySelector("[data-title]").onchange = (e) => { tpl.title = e.target.value.trim(); S.state.weekUpdatedAt = new Date().toISOString(); save(); };
  root.querySelector("[data-rest]").onchange = (e) => { tpl.rest = e.target.checked; changed(); };
  root.querySelector("[data-add]").onclick = () => editItem(null, (it) => { tpl.items.push(it); changed(); });
  root.querySelector("[data-copy]").onclick = () => copyDialog(wd);
  wireItems(root, () => tpl.items, changed);
}
function copyDialog(from) {
  import("../ui.js").then(({ sheet }) => sheet(`<div class="sheet-head"><h2>Copy ${WEEKDAYS[from]} to…</h2></div><div class="sheet-body">
    ${MON_FIRST.filter((d) => d !== from).map((d) => `<label class="row" style="font-weight:600"><input type="checkbox" value="${d}"> ${WEEKDAYS[d]}${S.state.week[d].items.length ? ` <span class="small muted">(replaces ${S.state.week[d].items.length} exercises)</span>` : ""}</label>`).join("")}
    </div><div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-go>Copy</button></div>`, {
    onMount(el, close) {
      el.querySelector("[data-go]").onclick = () => {
        const src = S.state.week[from];
        const to = [...el.querySelectorAll("input:checked")].map((i) => +i.value);
        to.forEach((d) => { S.state.week[d] = { title: src.title, rest: src.rest, items: src.items.map((i) => newItem(i)) }; });
        S.state.weekUpdatedAt = new Date().toISOString();
        save(); close(); toast(`Copied to ${to.length} day${to.length === 1 ? "" : "s"}`); rr();
      };
    },
  }));
}

function renderMonth(root, ym) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1), t = today();
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const prev = iso(new Date(y, m - 2, 1)).slice(0, 7), next = iso(new Date(y, m, 1)).slice(0, 7);
  const label = { done: "Done", partial: "Partly", missed: "Missed", planned: "", rest: "Rest", "": "" };
  root.innerHTML = `<div class="row between" style="margin-bottom:12px">
      <a class="btn small ghost icon" href="#/plan/month/${prev}" aria-label="Previous month">${icon("chevron-left")}</a>
      <h2>${first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
      <a class="btn small ghost icon" href="#/plan/month/${next}" aria-label="Next month">${icon("chevron-right")}</a></div>
    <div class="cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="h">${d}</div>`).join("")}
      ${"<span></span>".repeat(lead)}
      ${Array.from({ length: days }, (_, i) => {
        const d = iso(new Date(y, m - 1, i + 1)), x = getDay(d), st = dayState(d);
        return `<a href="#/day/${d}" class="${d === t ? "today" : ""} ${d < t ? "past" : ""} ${x.items.length ? "has" : ""}"><b>${i + 1}</b><span class="ct">${esc(x.rest && !x.items.length ? "Rest" : x.title || (x.items.length ? x.items.length + " exercises" : ""))}</span>
          ${label[st] ? `<span class="st ${st}">${label[st]}</span>` : ""}</a>`;
      }).join("")}</div>
    <p class="small muted" style="margin-top:10px">Tap a date to change its plan or see what you recorded.</p>`;
}

function renderDay(root, date) {
  const d = getDay(date), t = today(), past = date < t;
  const p = dayProgress(d);
  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow"><a href="#/plan/month/${date.slice(0, 7)}" class="link">${icon("chevron-left", "")} Calendar</a></div><h1>${esc(fmtDay(date))}</h1></div>
      <div class="row gap"><a class="btn small ghost icon" href="#/day/${addDays(date, -1)}" aria-label="Previous day">${icon("chevron-left")}</a><a class="btn small ghost icon" href="#/day/${addDays(date, 1)}" aria-label="Next day">${icon("chevron-right")}</a></div></div>
    <div class="card">
      <div class="row between wrap gap" style="margin-bottom:12px"><h2>Plan</h2>
        <span class="small muted">${d.virtual ? `From your ${WEEKDAYS[weekday(date)]} schedule` : "Custom plan for this date"}</span></div>
      <label class="field" style="margin-bottom:14px">Workout name<input class="input" data-title value="${esc(d.title)}" placeholder="e.g. Lower body + cardio"></label>
      <div data-items>${itemsEditor(d.items)}</div>
      <div class="row gap wrap" style="margin-top:12px">
        <button class="btn primary" data-add>${icon("plus")}Add exercise</button>
        ${d.items.length ? `<a class="btn" href="#/workout/${date}">${icon(past || d.startedAt ? "pencil" : "play")}${past || d.startedAt ? "Record results" : "Start workout"}</a>` : ""}
        ${!d.virtual ? `<button class="btn ghost" data-reset>${icon("rotate-ccw")}Use weekly schedule</button>` : ""}
      </div>
    </div>
    ${d.items.length && (past || d.startedAt) ? `<div class="section"><div class="section-head"><h2>Planned vs. actual</h2><span class="num" style="font-weight:700">${p.done}/${p.total}</span></div><div class="card">${pvaRows(d.items, { past })}</div></div>` : ""}`;
  const own = () => ensureDay(date);
  const changed = () => { touch(own()); save(); rr(); };
  root.querySelector("[data-title]").onchange = (e) => { own().title = e.target.value.trim(); changed(); };
  root.querySelector("[data-add]").onclick = () => editItem(null, (it) => { own().items.push(it); changed(); });
  root.querySelector("[data-reset]")?.addEventListener("click", async () => {
    if (!(await confirmBox("Replace this date's plan with the weekly schedule? Recorded results for this date will be removed.", { ok: "Replace" }))) return;
    delete S.state.days[date]; (S.state.deletedAt ||= {})["day:" + date] = new Date().toISOString(); save(); rr();
  });
  wireItems(root, () => own().items, changed);
}
