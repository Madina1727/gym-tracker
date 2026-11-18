// Progress: consistency, strength and cardio progression, body measurements, achievements, history, photos.
import { S, save, uid, now, today, addDays, weekStart, parseDay, savedDays, dayLogged, dayProgress, cardioMinutes, itemName, itemKind, exerciseKey, bestWeight, actualText, fmtDay, shortDay, toW, wUnit, status, isComplete, getDay, toD, dUnit, sUnit, remove } from "../store.js";
import { isCardio, kindOf, FIELDS } from "../kinds.js";
import { esc, icon, photoImg, pickPhotos, viewPhoto, deletePhoto, confirmBox, sheet, toast, paint } from "../ui.js";
import { lineChart, barChart, wireCharts } from "../charts.js";
import { editMeasurement, sortedMeasurements, latest, MEASURES, showM, unitM } from "../measure.js";
import { weekStats, streakWeeks } from "./home.js";

let ui = { ex: null, metric: null, mKey: "weight", photoTab: "body", picked: [] };

function heatmap() {
  const weeks = 16, start = addDays(weekStart(today()), -7 * (weeks - 1)), t = today();
  let cells = "";
  for (let w = 0; w < weeks; w++) for (let r = 0; r < 7; r++) {
    const d = addDays(start, w * 7 + r), x = S.state.days[d];
    let lvl = 0, label = "No workout";
    if (x && dayLogged(x)) { const p = dayProgress(x); lvl = p.pct >= 1 ? 4 : p.pct >= 0.66 ? 3 : p.pct >= 0.33 ? 2 : 1; label = `${p.done}/${p.total} completed`; }
    cells += `<i class="${d > t ? "future" : "l" + lvl}" title="${esc(fmtDay(d))}: ${d > t ? "" : label}"></i>`;
  }
  return `<div class="heat" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>
    <div class="heat-legend">Less <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> All targets met</div>`;
}
function weeklySeries(n, fn) {
  const out = [], ws = weekStart(today());
  for (let i = n - 1; i >= 0; i--) { const s = addDays(ws, -7 * i); out.push({ x: shortDay(s), tip: "Week of " + shortDay(s), v: fn(s) }); }
  return out;
}
const daysOfWeek = (s) => [0, 1, 2, 3, 4, 5, 6].map((i) => S.state.days[addDays(s, i)]).filter(Boolean);

/** Every exercise that has records, with its sessions oldest first. */
function exerciseLog() {
  const map = new Map();
  for (const [date, d] of [...savedDays()].reverse()) for (const it of d.items || []) {
    if (it.actual?.skipped || !actualText(it)) continue;
    const k = exerciseKey(it);
    if (!map.has(k)) map.set(k, { key: k, name: itemName(it), kind: itemKind(it), sessions: [] });
    map.get(k).sessions.push({ date, it });
  }
  return [...map.values()].sort((a, b) => b.sessions.length - a.sessions.length);
}
function achievements(log) {
  const logged = savedDays().filter(([, d]) => dayLogged(d)).length;
  const fullDays = savedDays().filter(([, d]) => d.items.length && d.items.every(isComplete)).length;
  let bestWeekMin = 0; const seen = new Set();
  for (const [date] of savedDays()) { const w = weekStart(date); if (seen.has(w)) continue; seen.add(w); bestWeekMin = Math.max(bestWeekMin, daysOfWeek(w).reduce((s, d) => s + cardioMinutes(d), 0)); }
  const prs = log.filter((e) => !isCardio(e.kind) && e.sessions.length > 1 && bestWeight(e.sessions[e.sessions.length - 1].it) >= Math.max(...e.sessions.map((s) => bestWeight(s.it))) && bestWeight(e.sessions[e.sessions.length - 1].it) > bestWeight(e.sessions[0].it)).length;
  return [
    ["flag", "First workout", "Record your first session", logged >= 1],
    ["calendar-check", "10 workouts", `${Math.min(logged, 10)}/10`, logged >= 10],
    ["calendar-range", "50 workouts", `${Math.min(logged, 50)}/50`, logged >= 50],
    ["circle-check-big", "Every target met", "A day with all exercises completed", fullDays >= 1],
    ["flame", "4-week streak", `Meet your weekly goal 4 weeks in a row (now ${streakWeeks()})`, streakWeeks() >= 4],
    ["heart-pulse", "150 cardio minutes in a week", `Best week: ${bestWeekMin} min`, bestWeekMin >= 150],
    ["trophy", "Lifting heavier", prs ? `${prs} exercise${prs === 1 ? "" : "s"} at a new best weight` : "Beat your first recorded weight on an exercise", prs >= 1],
  ];
}

export function render(root) {
  const log = exerciseLog();
  const t = today();
  // Tiles: last 30 days.
  let planned = 0, completed = 0, workouts = 0, minutes = 0;
  for (let i = 0; i < 30; i++) {
    const date = addDays(t, -i), d = S.state.days[date] || (date < t ? getDay(date) : null);
    if (!d || (!S.state.days[date] && S.state.startedOn && date < S.state.startedOn)) continue;
    if (date <= t) { planned += date < t || d.startedAt ? d.items.length : 0; completed += d.items.filter(isComplete).length; }
    if (S.state.days[date] && dayLogged(d)) { workouts++; minutes += cardioMinutes(d); }
  }
  const wNow = latest("weight"), ms = sortedMeasurements().filter((m) => m.weight != null);
  const wChange = ms.length > 1 ? ms[ms.length - 1].weight - ms[0].weight : null;

  if (!ui.ex || !log.find((e) => e.key === ui.ex)) ui.ex = (log.find((e) => !isCardio(e.kind)) || log[0])?.key || null;
  const ex = log.find((e) => e.key === ui.ex);
  let exChart = "";
  if (ex) {
    const cardio = isCardio(ex.kind);
    const metrics = cardio ? kindOf(ex.kind).fields.filter((f) => ex.sessions.some((s) => s.it.actual[f] != null)) : ["weight", "volume"];
    if (!metrics.includes(ui.metric)) ui.metric = metrics[0];
    const pts = ex.sessions.map(({ date, it }) => {
      let v;
      if (!cardio) v = ui.metric === "weight" ? +toW(bestWeight(it)) : Math.round((it.actual.sets || []).filter((s) => s.done || s.reps != null).reduce((s, x) => s + (+(x.reps ?? it.target.reps) || 0) * (+toW(x.weight ?? it.target.weight) || 0), 0));
      else v = ["distance", "speed"].includes(ui.metric) ? +toD(it.actual[ui.metric]) : +it.actual[ui.metric] || 0;
      return { x: shortDay(date), tip: fmtDay(date, { weekday: "short", month: "short", day: "numeric" }), v };
    }).filter((p) => p.v > 0 || cardio);
    const unit = cardio ? (ui.metric === "distance" ? dUnit() : ui.metric === "speed" ? sUnit() : FIELDS[ui.metric]?.unit) : ui.metric === "weight" ? wUnit() : wUnit();
    exChart = `<div class="row gap wrap" style="margin-bottom:12px">
        <select class="input" data-ex style="flex:2;min-width:180px">${log.map((e) => `<option value="${esc(e.key)}" ${e.key === ui.ex ? "selected" : ""}>${esc(e.name)} (${e.sessions.length})</option>`).join("")}</select>
        <div class="seg">${metrics.map((m) => `<button class="${m === ui.metric ? "on" : ""}" data-metric="${m}">${m === "weight" ? "Heaviest set" : m === "volume" ? "Total volume" : FIELDS[m].label}</button>`).join("")}</div></div>
      ${pts.length ? lineChart(pts, { unit, label: `${ex.name} progress` }) : `<p class="muted">No numbers recorded for this yet.</p>`}
      ${!cardio && ui.metric === "volume" ? `<p class="small muted" style="margin-top:6px">Volume = reps × weight, added up over all sets.</p>` : ""}`;
  }

  const mPts = sortedMeasurements().filter((m) => m[ui.mKey] != null).map((m) => ({ x: shortDay(m.date), tip: fmtDay(m.date), v: +showM(ui.mKey, m[ui.mKey]) }));
  const goalW = ui.mKey === "weight" && S.state.profile.targetWeight ? +toW(S.state.profile.targetWeight) : null;
  const history = savedDays().filter(([k, d]) => k <= t && (dayLogged(d) || d.finishedAt)).slice(0, 12);

  root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Progress</div><h1>Your progress</h1></div></div>
    <div class="grid tiles">
      <div class="tile"><div class="label">Workouts, last 30 days</div><div class="value num">${workouts}</div><div class="sub">This week ${weekStats().workouts}/${S.state.profile.goalPerWeek}</div></div>
      <div class="tile"><div class="label">Targets completed</div><div class="value num">${planned ? Math.round((completed / planned) * 100) : 0}<small>%</small></div><div class="sub">${completed} of ${planned} planned, 30 days</div></div>
      <div class="tile"><div class="label">Cardio, last 30 days</div><div class="value num">${minutes}<small>min</small></div><div class="sub">${Math.round(minutes / 4.3)} min a week on average</div></div>
      <div class="tile"><div class="label">Body weight</div><div class="value num">${wNow ? `${toW(wNow.weight)}<small>${wUnit()}</small>` : "–"}</div><div class="sub">${wChange != null ? `${wChange > 0 ? "+" : ""}${toW(wChange)} ${wUnit()} since ${shortDay(ms[0].date)}` : `<a class="link" href="#" data-addm>Add your weight</a>`}</div></div>
    </div>

    <div class="grid two section">
      <div class="card"><div class="section-head"><h2>Consistency</h2><span class="small muted">Last 16 weeks</span></div>${heatmap()}</div>
      <div class="card"><div class="section-head"><h2>Workouts per week</h2><span class="small muted">Dashed line: goal ${S.state.profile.goalPerWeek}</span></div>
        ${barChart(weeklySeries(12, (s) => daysOfWeek(s).filter(dayLogged).length), { unit: "workouts", goal: S.state.profile.goalPerWeek, label: "Workouts per week", integer: true })}</div>
    </div>

    <div class="grid two section">
      <div class="card"><div class="section-head"><h2>Exercise progress</h2></div>${ex ? exChart : `<div class="empty"><p>Record a workout to see strength and cardio progress here.</p></div>`}</div>
      <div class="card"><div class="section-head"><h2>Cardio minutes per week</h2></div>
        ${barChart(weeklySeries(12, (s) => daysOfWeek(s).reduce((a, d) => a + cardioMinutes(d), 0)), { unit: "min", label: "Cardio minutes per week" })}</div>
    </div>

    <div class="section card">
      <div class="section-head"><h2>Body measurements</h2><button class="btn small" data-addm>${icon("plus")}Add</button></div>
      <div class="chips" style="margin-bottom:12px">${MEASURES.map(([k, l]) => `<button class="chip ${k === ui.mKey ? "on" : ""}" data-mk="${k}">${l}</button>`).join("")}</div>
      <div class="measure-grid"><div>${mPts.length ? lineChart(mPts, { unit: unitM(ui.mKey), goal: goalW, label: MEASURES.find((m) => m[0] === ui.mKey)[1] }) : `<div class="empty"><p>No ${MEASURES.find((m) => m[0] === ui.mKey)[1].toLowerCase()} entries yet.</p></div>`}</div>
      <div class="stack" style="gap:0">${MEASURES.map(([k, l]) => { const all = sortedMeasurements().filter((m) => m[k] != null), last = all[all.length - 1], first = all[0];
        const ch = all.length > 1 ? +showM(k, last[k]) - +showM(k, first[k]) : null;
        return `<div class="list-item" style="padding:8px 0"><div class="main"><div class="s">${l}</div></div><b class="num">${last ? esc(showM(k, last[k])) + " " + esc(unitM(k)) : "–"}</b><span class="small muted num" style="min-width:64px;text-align:right">${ch != null ? (ch > 0 ? "+" : "") + Math.round(ch * 10) / 10 : ""}</span></div>`; }).join("")}
        <p class="small muted" style="margin-top:6px">Latest value and change since your first entry.</p></div></div>
      ${S.state.measurements.length ? `<details class="tbl"><summary>All entries (${S.state.measurements.length})</summary><div class="table-scroll"><table class="data"><thead><tr><th>Date</th>${MEASURES.map(([k, l]) => `<th>${l} (${unitM(k)})</th>`).join("")}<th></th></tr></thead><tbody>
        ${[...sortedMeasurements()].reverse().map((m) => `<tr><td>${esc(shortDay(m.date))}</td>${MEASURES.map(([k]) => `<td>${m[k] != null ? esc(showM(k, m[k])) : "–"}</td>`).join("")}<td><button class="btn small ghost icon" data-em="${m.id}" aria-label="Edit">${icon("pencil")}</button></td></tr>`).join("")}</tbody></table></div></details>` : ""}
    </div>

    <div class="grid two section">
      <div class="card"><div class="section-head"><h2>Achievements</h2></div>
        <div class="stack" style="gap:0">${achievements(log).map(([ic, t1, sub, ok]) => `<div class="list-item" style="padding:10px 0;${ok ? "" : "opacity:.55"}"><span class="kind-ic ${ok ? "strength" : ""}" style="${ok ? "" : "background:var(--surface-2);color:var(--muted)"}">${icon(ok ? ic : "lock")}</span><div class="main"><div class="t">${esc(t1)}</div><div class="s">${esc(sub)}</div></div>${ok ? `<span class="status done">${icon("check")}Earned</span>` : ""}</div>`).join("")}</div></div>
      <div class="card"><div class="section-head"><h2>Workout history</h2><a href="#/plan/month">Calendar</a></div>
        ${history.length ? `<div class="stack" style="gap:0">${history.map(([k, d]) => { const p = dayProgress(d); return `<a class="list-item" style="padding:10px 0" href="#/workout/${k}"><div class="main"><div class="t">${esc(d.title || "Workout")}</div><div class="s">${esc(fmtDay(k))}${cardioMinutes(d) ? ` · ${cardioMinutes(d)} min cardio` : ""}</div></div><span class="num" style="font-weight:700;color:${p.done === p.total ? "var(--done)" : "var(--ink)"}">${p.done}/${p.total}</span></a>`; }).join("")}</div>`
        : `<div class="empty"><p>Finished workouts show up here.</p></div>`}</div>
    </div>

    <div class="section card" id="photos">
      <div class="section-head"><h2>Photos</h2><div class="seg"><button class="${ui.photoTab === "body" ? "on" : ""}" data-pt="body">Before and after</button><button class="${ui.photoTab === "workout" ? "on" : ""}" data-pt="workout">Workout records</button></div></div>
      <div data-photos></div>
    </div>`;

  renderPhotos(root.querySelector("[data-photos]"));
  wireCharts(root);
  const rr = () => window.__rerender();
  root.querySelector("[data-ex]")?.addEventListener("change", (e) => { ui.ex = e.target.value; ui.metric = null; rr(); });
  root.querySelectorAll("[data-metric]").forEach((b) => b.onclick = () => { ui.metric = b.dataset.metric; rr(); });
  root.querySelectorAll("[data-mk]").forEach((b) => b.onclick = () => { ui.mKey = b.dataset.mk; rr(); });
  root.querySelectorAll("[data-addm]").forEach((b) => b.onclick = (e) => { e.preventDefault(); editMeasurement(null, rr); });
  root.querySelectorAll("[data-em]").forEach((b) => b.onclick = () => editMeasurement(S.state.measurements.find((m) => m.id === b.dataset.em), rr));
  root.querySelectorAll("[data-pt]").forEach((b) => b.onclick = () => { ui.photoTab = b.dataset.pt; ui.picked = []; rr(); });
}

function renderPhotos(el) {
  const rr = () => window.__rerender();
  if (ui.photoTab === "workout") {
    const all = [];
    for (const [date, d] of savedDays()) {
      for (const p of d.photos || []) all.push({ id: p, date, cap: d.title || "Workout" });
      for (const it of d.items || []) for (const p of it.actual?.photos || []) all.push({ id: p, date, cap: itemName(it) });
    }
    el.innerHTML = all.length ? `<div class="photo-grid">${all.map((p) => `<button data-view="${esc(p.id)}" data-cap="${esc(p.cap + " · " + shortDay(p.date))}">${photoImg(p.id, "", p.cap)}<span class="cap">${esc(p.cap)}<br>${esc(shortDay(p.date))}</span></button>`).join("")}</div>`
      : `<div class="empty">${icon("camera")}<p>Photos you take of machine screens and results during a workout appear here.</p></div>`;
    el.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => viewPhoto(b.dataset.view, b.dataset.cap));
    paint(el); return;
  }
  const photos = [...S.state.progressPhotos].sort((a, b) => (a.date < b.date ? -1 : 1));
  const picked = ui.picked.map((id) => photos.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1));
  el.innerHTML = `
    <div class="row gap wrap" style="margin-bottom:12px"><button class="btn" data-addp>${icon("camera")}Add progress photo</button>
      ${photos.length > 1 ? `<span class="small muted">Select two photos to compare them side by side.</span>` : ""}</div>
    ${picked.length === 2 ? `<div class="compare" style="margin-bottom:14px">${picked.map((p, i) => `<figure>${photoImg(p.photo, "", "")}<figcaption>${i ? "After" : "Before"} · ${esc(fmtDay(p.date, { month: "short", day: "numeric", year: "numeric" }))}${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ""}</figcaption></figure>`).join("")}</div>
      <p class="small muted" style="margin:-4px 0 12px">${Math.round((parseDay(picked[1].date) - parseDay(picked[0].date)) / 86400000)} days apart</p>` : ""}
    ${photos.length ? `<div class="photo-grid">${photos.map((p) => `<button class="${ui.picked.includes(p.id) ? "sel" : ""}" data-pick="${p.id}" aria-pressed="${ui.picked.includes(p.id)}">${photoImg(p.photo, "", "Progress photo")}<span class="cap">${esc(shortDay(p.date))}${p.pose ? " · " + esc(p.pose) : ""}</span></button>`).join("")}</div>
      ${ui.picked.length === 1 ? `<div class="row gap" style="margin-top:10px"><button class="btn small" data-openp>${icon("maximize-2")}View</button><button class="btn small ghost" data-delp style="color:var(--missed)">${icon("trash-2")}Delete</button></div>` : ""}`
      : `<div class="empty">${icon("image")}<p>Take a photo now and then, in the same spot and pose, to see the change over time. Photos stay private to your account.</p></div>`}`;
  el.querySelector("[data-addp]").onclick = () => addProgressPhoto(rr);
  el.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => { const id = b.dataset.pick; ui.picked = ui.picked.includes(id) ? ui.picked.filter((x) => x !== id) : [...ui.picked, id].slice(-2); rr(); });
  el.querySelector("[data-openp]")?.addEventListener("click", () => { const p = photos.find((x) => x.id === ui.picked[0]); viewPhoto(p.photo, fmtDay(p.date) + (p.note ? " · " + p.note : "")); });
  el.querySelector("[data-delp]")?.addEventListener("click", async () => {
    const p = photos.find((x) => x.id === ui.picked[0]);
    if (!(await confirmBox("Delete this progress photo?"))) return;
    await deletePhoto(p.photo); remove(S.state.progressPhotos, p.id); ui.picked = []; save(); rr();
  });
  paint(el);
}
export async function addProgressPhoto(done) {
  const ids = await pickPhotos({ camera: true, multiple: false });
  if (!ids.length) return;
  sheet(`<div class="sheet-head"><h2>Progress photo</h2></div><div class="sheet-body">
      ${photoImg(ids[0], "", "")}
      <label class="field">Date<input class="input" type="date" name="date" value="${today()}" max="${today()}"></label>
      <label class="field">Pose<select class="input" name="pose"><option value="">–</option><option>Front</option><option>Side</option><option>Back</option></select></label>
      <label class="field">Note<input class="input" name="note" placeholder="Optional"></label></div>
    <div class="sheet-foot"><button class="btn primary" data-save>Save photo</button></div>`, {
    onMount(el, close) {
      el.querySelector("img").style.cssText = "max-height:40vh;object-fit:contain;border-radius:12px;width:100%";
      el.querySelector("[data-save]").onclick = () => {
        S.state.progressPhotos.push({ id: uid(), photo: ids[0], date: el.querySelector("[name=date]").value || today(), pose: el.querySelector("[name=pose]").value, note: el.querySelector("[name=note]").value.trim(), updatedAt: now() });
        save(); close(); toast("Photo saved"); done?.();
      };
    },
  });
}
void status; void toast;
