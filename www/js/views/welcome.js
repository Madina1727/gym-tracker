// First run: name, weekly goal, units, and an optional example plan.
import { S, save, uid, now, weekday, today, WEEKDAYS, newItem } from "../store.js";
import { esc, icon } from "../ui.js";
import { syncEnabled } from "../sync.js";

let choice = "example";
export function render(root) {
  const p = S.state.profile, wd = weekday(today());
  root.innerHTML = `<div class="welcome">
    <div class="brand" style="margin-bottom:28px"><span class="brand-mark"></span><span>Gym Tracker</span></div>
    <h1>Plan the session. Record what you did. See the progress.</h1>
    <p class="lead">Set targets for each gym day, log your real numbers on every machine, and compare planned with actual.</p>
    <div class="card stack" style="margin-top:22px">
      <label class="field">What should we call you?<input class="input" data-name value="${esc(p.name)}" placeholder="Your name" autofocus></label>
      <div class="fields"><label class="field">Workouts per week<select class="input" data-goal>${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option ${n === p.goalPerWeek ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="field">Units<select class="input" data-units><option value="metric">kg, km</option><option value="imperial" ${p.units === "imperial" ? "selected" : ""}>lb, mi</option></select></label></div>
    </div>
    <div class="stack" style="margin-top:16px">
      <button class="choice ${choice === "example" ? "on" : ""}" data-choice="example">${icon("list-checks")}<div><div class="t">Start with an example day</div><div class="s">Adds a treadmill, stair climber, hip thrust and leg press to your equipment, and a "Lower body + cardio" plan on ${WEEKDAYS[wd]}s. Change or delete anything later.</div></div></button>
      <button class="choice ${choice === "empty" ? "on" : ""}" data-choice="empty">${icon("square-dashed")}<div><div class="t">Start empty</div><div class="s">Build your equipment library and weekly plan yourself.</div></div></button>
    </div>
    <button class="btn primary block" data-go style="margin-top:18px;height:50px">Get started</button>
    ${syncEnabled ? `<p class="muted small" style="text-align:center;margin-top:14px">Already use Gym Tracker on another device? <a class="link" href="#/profile#sync" data-signin>Sign in</a></p>` : ""}
  </div>`;
  root.querySelectorAll("[data-choice]").forEach((b) => b.onclick = () => { choice = b.dataset.choice; root.querySelectorAll("[data-choice]").forEach((x) => x.classList.toggle("on", x === b)); });
  const read = () => { p.name = root.querySelector("[data-name]").value.trim(); p.goalPerWeek = +root.querySelector("[data-goal]").value; p.units = root.querySelector("[data-units]").value; S.state.profileUpdatedAt = now(); };
  root.querySelector("[data-signin]")?.addEventListener("click", () => { read(); S.state.onboarded = true; S.state.startedOn ||= today(); save(); });
  root.querySelector("[data-go]").onclick = () => {
    read();
    if (choice === "example") addExample(wd);
    S.state.onboarded = true; S.state.startedOn ||= today(); save(); location.hash = "#/";
  };
}
function addExample(wd) {
  const mk = (name, kind, muscles, defaultTarget) => { const e = { id: uid(), name, kind, muscles, instructions: "", settings: "", favorite: false, photos: [], defaultTarget, createdAt: now(), updatedAt: now() }; S.state.equipment.push(e); return e; };
  const tm = mk("Treadmill", "treadmill", ["Heart and lungs", "Quads", "Calves"], { minutes: 15 });
  const st = mk("Stair climber", "stair", ["Heart and lungs", "Glutes", "Quads"], { minutes: 10 });
  const ht = mk("Hip thrust machine", "machine", ["Glutes", "Hamstrings"], { sets: 3, reps: 12 });
  const lp = mk("Leg press", "machine", ["Quads", "Glutes", "Hamstrings"], { sets: 3, reps: 15 });
  S.state.week[wd] = { title: "Lower body + cardio", rest: false, items: [tm, st, ht, lp].map((e) => newItem({ equipmentId: e.id, kind: e.kind, name: e.name, target: e.defaultTarget })) };
  S.state.weekUpdatedAt = now();
}
