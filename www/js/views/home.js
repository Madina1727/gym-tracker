// Home: today's workout, planned vs actual, this week.
import { S, today, getDay, dayProgress, fmtDay, addDays, weekStart, parseDay, dayLogged, status, savedDays, cardioMinutes } from "../store.js";
import { esc, icon } from "../ui.js";
import { pvaRows } from "../parts.js";

export function dayState(date) {
  const d = getDay(date);
  if (!d.items.length) return d.rest ? "rest" : "";
  const p = dayProgress(d);
  if (p.done === p.total) return "done";
  if (dayLogged(d) || p.done) return "partial";
  return date < today() ? "missed" : "planned";
}
export function weekStrip(selected, hrefFor = (d) => `#/day/${d}`) {
  const start = weekStart(selected), t = today();
  return `<div class="week-strip">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(start, i), dt = parseDay(d);
    return `<a href="${hrefFor(d)}" class="${d === t ? "today" : ""} ${d === selected ? "sel" : ""}" aria-label="${esc(fmtDay(d))}">
      ${dt.toLocaleDateString(undefined, { weekday: "narrow" })}<b>${dt.getDate()}</b><span class="dot ${dayState(d)}"></span></a>`;
  }).join("")}</div>`;
}
export function weekStats(anchor = today()) {
  const start = weekStart(anchor);
  let workouts = 0, minutes = 0;
  for (let i = 0; i < 7; i++) { const d = S.state.days[addDays(start, i)]; if (d && dayLogged(d)) { workouts++; minutes += cardioMinutes(d); } }
  return { workouts, minutes };
}
/** Weeks in a row (ending this week or last) that met the weekly goal. */
export function streakWeeks() {
  const goal = S.state.profile.goalPerWeek || 1;
  let w = weekStart(today()), n = 0;
  if (weekStats(w).workouts < goal) w = addDays(w, -7);
  while (weekStats(w).workouts >= goal && n < 520) { n++; w = addDays(w, -7); }
  return n;
}

export function render(root) {
  const t = today(), d = getDay(t), p = dayProgress(d), ws = weekStats(), goal = S.state.profile.goalPerWeek;
  const name = S.state.profile.name;
  const started = !!d.startedAt && !d.finishedAt, finished = !!d.finishedAt;
  const last = savedDays().find(([k, x]) => k < t && dayLogged(x));
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  let hero;
  if (!d.items.length) {
    hero = `<div class="hero"><div class="eyebrow">${esc(fmtDay(t))}</div><h2>${d.rest ? "Rest day" : "Nothing planned today"}</h2>
      <p class="rest-note">${d.rest ? "Recovery is part of the plan." : "Add exercises for today, or set up your weekly plan."}</p>
      <div class="hero-actions"><a class="btn volt" href="#/day/${t}">${icon("plus")}Plan today</a>${d.rest ? "" : `<a class="btn ghost-light" href="#/plan">${icon("calendar-days")}Weekly plan</a>`}</div></div>`;
  } else {
    hero = `<div class="hero"><div class="eyebrow">Today's workout · ${esc(fmtDay(t, { weekday: "long", month: "short", day: "numeric" }))}</div>
      <h2>${esc(d.title || "Workout")}</h2>
      <div class="hero-count"><b class="num">${p.done}/${p.total}</b><span>completed</span></div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
      <div class="hero-actions"><a class="btn volt" href="#/workout/${t}">${icon(finished ? "pencil" : started ? "timer" : "play")}${finished ? "Edit today's record" : started ? "Continue workout" : "Start workout"}</a></div></div>`;
  }

  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">${hello}${name ? ", " + esc(name) : ""}</div><h1>Today</h1></div></div>
    <div class="home-grid">
      <div>
        ${hero}
        ${d.items.length ? `<div class="section"><div class="section-head"><h2>Planned vs. actual</h2><a href="#/day/${t}">Edit plan</a></div>
          <div class="card">${pvaRows(d.items)}</div></div>` : ""}
      </div>
      <div>
        <div class="section"><div class="section-head"><h2>This week</h2><a href="#/plan">My plan</a></div>${weekStrip(t)}</div>
        <div class="section grid tiles" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="tile"><div class="label">Workouts this week</div><div class="value num">${ws.workouts}<small>/ ${goal}</small></div><div class="sub">${ws.workouts >= goal ? "Weekly goal reached" : `${goal - ws.workouts} to go`}</div></div>
          <div class="tile"><div class="label">Cardio this week</div><div class="value num">${ws.minutes}<small>min</small></div><div class="sub">Streak: ${streakWeeks()} wk${streakWeeks() === 1 ? "" : "s"} on goal</div></div>
        </div>
        ${last ? `<div class="section"><div class="section-head"><h2>Last workout</h2><a href="#/workout/${last[0]}">Open</a></div>
          <a class="list"><div class="list-item"><div class="main"><div class="t">${esc(last[1].title || "Workout")}</div><div class="s">${esc(fmtDay(last[0]))}</div></div>
          <span class="num" style="font-weight:700">${dayProgress(last[1]).done}/${dayProgress(last[1]).total}</span></div></a></div>` : ""}
        ${S.state.equipment.length ? "" : `<div class="section"><div class="empty">${icon("dumbbell")}<p>Add the machines you use to your equipment library, with photos and your settings.</p><a class="btn" href="#/equipment/new">${icon("plus")}Add equipment</a></div></div>`}
      </div>
    </div>`;
  void status;
}
