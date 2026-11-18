// Small SVG charts: line over time and bars, each with a hover tooltip and a table view.
import { esc } from "./ui.js";

const W = 640, H = 220, PAD = { l: 40, r: 12, t: 14, b: 26 };
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw || 1)); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
/** Round axis bounds and evenly spaced round tick values. */
function niceScale(lo, hi, integer = false) {
  let step = niceStep((hi - lo) / 4 || 1);
  if (integer) step = Math.max(1, Math.round(step));
  const a = Math.floor(lo / step) * step, b = Math.max(a + step, Math.ceil(hi / step) * step);
  const ticks = []; for (let v = a; v <= b + step / 1000; v += step) ticks.push(+v.toFixed(6));
  return { lo: a, hi: b, ticks };
}
const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString();

/** points: [{x: label, v: number, tip: string}] in order. */
export function lineChart(points, { unit = "", goal = null, zero = false, label = "" } = {}) {
  if (!points.length) return "";
  const vals = points.map((p) => p.v).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (zero) lo = 0; else { const pad = (hi - lo) * 0.1 || Math.max(1, hi * 0.03); lo = Math.max(0, lo - pad); hi = hi + pad; }
  const sc = niceScale(lo, hi); lo = sc.lo; hi = sc.hi;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const X = (i) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const Y = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const path = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const area = `${path}L${X(points.length - 1).toFixed(1)},${PAD.t + ih}L${X(0).toFixed(1)},${PAD.t + ih}Z`;
  const step = Math.max(1, Math.ceil(points.length / 6));
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${sc.ticks.map((t) => `<line class="grid-line" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${PAD.l - 6}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("")}
    ${goal != null ? `<line class="goal" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(goal)}" y2="${Y(goal)}"/><text x="${W - PAD.r}" y="${Y(goal) - 5}" text-anchor="end">Goal ${fmt(goal)} ${esc(unit)}</text>` : ""}
    <path class="area" d="${area}"/><path class="line" d="${path}"/>
    ${points.map((p, i) => (points.length <= 24 || i === points.length - 1) ? `<circle class="dot" cx="${X(i)}" cy="${Y(p.v)}" r="4"/>` : "").join("")}
    ${points.map((p, i) => i % step === 0 || i === points.length - 1 ? `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(p.x)}</text>` : "").join("")}
    <line class="cross" data-cross x1="0" x2="0" y1="${PAD.t}" y2="${PAD.t + ih}" visibility="hidden"/>
    ${points.map((p, i) => { const x0 = i ? (X(i - 1) + X(i)) / 2 : PAD.l, x1 = i < points.length - 1 ? (X(i) + X(i + 1)) / 2 : W - PAD.r; return `<rect class="hit" x="${x0}" y="${PAD.t}" width="${Math.max(1, x1 - x0)}" height="${ih}" data-i="${i}" data-cx="${X(i)}" data-cy="${Y(p.v)}"/>`; }).join("")}
  </svg>`;
  return wrap(svg, points, unit);
}

export function barChart(points, { unit = "", label = "", goal = null, integer = false } = {}) {
  if (!points.length) return "";
  const sc = niceScale(0, Math.max(...points.map((p) => p.v), goal || 0, integer ? 4 : 1), integer), hi = sc.hi;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bw = iw / points.length, gap = Math.min(10, bw * 0.3);
  const Y = (v) => PAD.t + ih - (v / hi) * ih;
  const step = Math.max(1, Math.ceil(points.length / 8));
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${sc.ticks.map((t) => `<line class="grid-line" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${PAD.l - 6}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("")}
    ${goal ? `<line class="goal" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(goal)}" y2="${Y(goal)}"/>` : ""}
    ${points.map((p, i) => { const x = PAD.l + i * bw + gap / 2, w = bw - gap, h = Math.max(0, (p.v / hi) * ih), y = PAD.t + ih - h, r = Math.min(4, w / 2, h);
      return p.v > 0 ? `<path class="barm" d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z"/>` : ""; }).join("")}
    ${points.map((p, i) => i % step === 0 || i === points.length - 1 ? `<text x="${PAD.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(p.x)}</text>` : "").join("")}
    ${points.map((p, i) => `<rect class="hit" x="${PAD.l + i * bw}" y="${PAD.t}" width="${bw}" height="${ih}" data-i="${i}" data-cx="${PAD.l + i * bw + bw / 2}" data-cy="${Y(p.v)}"/>`).join("")}
  </svg>`;
  return wrap(svg, points, unit);
}

function wrap(svg, points, unit) {
  const data = esc(JSON.stringify(points.map((p) => [p.tip || p.x, fmt(p.v) + (unit ? " " + unit : "")])));
  return `<div class="chart-wrap" data-chart='${data}'>${svg}<div class="tip"></div></div>
    <details class="tbl"><summary>Show as table</summary><div class="table-scroll"><table class="data"><thead><tr><th>Date</th><th>Value</th></tr></thead><tbody>
    ${points.map((p) => `<tr><td>${esc(p.tip || p.x)}</td><td>${esc(fmt(p.v))} ${esc(unit)}</td></tr>`).join("")}</tbody></table></div></details>`;
}

/** Wires hover/touch tooltips for every chart inside root. */
export function wireCharts(root) {
  root.querySelectorAll("[data-chart]").forEach((wrapEl) => {
    const data = JSON.parse(wrapEl.dataset.chart), tip = wrapEl.querySelector(".tip"), svg = wrapEl.querySelector("svg"), cross = svg.querySelector("[data-cross]");
    const show = (r) => {
      const i = +r.dataset.i, box = svg.getBoundingClientRect(), sx = box.width / W;
      tip.innerHTML = `<span>${esc(data[i][0])}</span>${esc(data[i][1])}`;
      tip.style.left = (+r.dataset.cx * sx) + "px"; tip.style.top = (+r.dataset.cy * sx) + "px";
      tip.classList.add("show");
      if (cross) { cross.setAttribute("x1", r.dataset.cx); cross.setAttribute("x2", r.dataset.cx); cross.setAttribute("visibility", "visible"); }
    };
    const hide = () => { tip.classList.remove("show"); cross?.setAttribute("visibility", "hidden"); };
    svg.querySelectorAll(".hit").forEach((r) => { r.addEventListener("pointerenter", () => show(r)); r.addEventListener("pointerdown", () => show(r)); });
    svg.addEventListener("pointerleave", hide);
  });
}
