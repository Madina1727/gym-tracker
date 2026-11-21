import { createRequire } from "node:module";
const require = createRequire("/Users/madina/Desktop/wayu-korea/package.json");
const { chromium } = require("playwright");
const out = process.cwd() + "/";
const browser = await chromium.launch();
// icons
{ const p = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const svg = (await import("node:fs")).readFileSync("/Users/madina/Desktop/gym-tracker/www/icons/icon.svg", "utf8");
  for (const [n, s, mask] of [["icon-192", 192], ["icon-512", 512], ["icon-512-maskable", 512, true]]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<body style="margin:0;background:#111412">${mask ? `<div style="width:${s}px;height:${s}px;display:grid;place-items:center"><div style="width:${s*0.8}px;height:${s*0.8}px">${svg.replace('rx="112"','rx="0"')}</div></div>` : svg.replace("<svg ", `<svg width="${s}" height="${s}" `)}</body>`);
    await p.screenshot({ path: `/Users/madina/Desktop/gym-tracker/www/icons/${n}.png`, omitBackground: !mask });
  } await p.close(); }

const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
const U = "http://localhost:5190/";
await page.goto(U); await page.waitForTimeout(800);
await page.screenshot({ path: out + "m01-welcome.png", fullPage: true });
await page.fill("[data-name]", "Madina");
await page.click("[data-go]"); await page.waitForTimeout(500);
await page.screenshot({ path: out + "m02-home.png", fullPage: true });
await page.click("text=Start workout"); await page.waitForTimeout(500);
// treadmill: open by default, type 18 min, 2.1 km
await page.fill('[data-ex="0"] [name=a_minutes]', "18");
await page.fill('[data-ex="0"] [name=a_distance]', "2.1");
await page.fill('[data-ex="0"] [name=a_calories]', "160");
await page.click('[data-ex="1"] [data-toggle]');
await page.fill('[data-ex="1"] [name=a_minutes]', "12");
await page.fill('[data-ex="1"] [name=a_floors]', "40");
await page.click('[data-ex="2"] [data-toggle]');
for (let i = 0; i < 3; i++) { await page.fill(`[data-ex="2"] [data-set="${i}"] [data-k=weight]`, "40"); await page.click(`[data-ex="2"] [data-set="${i}"] [data-check]`); }
await page.waitForTimeout(400);
await page.screenshot({ path: out + "m03-workout.png", fullPage: true });
await page.click('[data-ex="3"] [data-toggle]');
await page.click('[data-ex="3"] [data-skip]'); await page.waitForTimeout(300);
page.click("[data-finish]"); await page.waitForTimeout(400);
await page.click("[data-yes]"); await page.waitForTimeout(600);
await page.screenshot({ path: out + "m04-home-after.png", fullPage: true });
// add measurement
await page.goto(U + "#/progress"); await page.waitForTimeout(400);
await page.click("button[data-addm]"); await page.fill(".sheet [name=weight]", "62.5"); await page.fill(".sheet [name=waist]", "70"); await page.click(".sheet [data-save]"); await page.waitForTimeout(400);
// add an older one
await page.evaluate(async () => { const { S, save } = await import("./js/store.js"); S.state.measurements.push({ id: "m0", date: "2026-10-20", weight: 64, waist: 72 }); save(); });
await page.goto(U + "#/plan"); await page.waitForTimeout(300); await page.goto(U + "#/progress"); await page.waitForTimeout(500);
await page.screenshot({ path: out + "m05-progress.png", fullPage: true });
await page.goto(U + "#/plan"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m06-plan.png", fullPage: true });
await page.goto(U + "#/plan/month"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m07-cal.png", fullPage: true });
await page.goto(U + "#/equipment"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m08-equip.png", fullPage: true });
await page.click(".eq-card >> nth=2"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m09-equip-detail.png", fullPage: true });
await page.click("text=Edit"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m10-equip-edit.png", fullPage: true });
await page.goto(U + "#/profile"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m11-profile.png", fullPage: true });
// add exercise sheet
await page.goto(U + "#/plan"); await page.waitForTimeout(300); await page.click("[data-add]"); await page.waitForTimeout(400);
await page.screenshot({ path: out + "m12-add.png" });
await page.click(".sheet [data-eq] >> nth=0"); await page.waitForTimeout(300);
await page.screenshot({ path: out + "m13-add-target.png" });
// desktop + dark
const st = await page.evaluate(async () => { const { S } = await import("./js/store.js"); return JSON.stringify(S.state); });
const d = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: "dark" });
const dp = await d.newPage(); dp.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
await dp.goto(U); await dp.evaluate(async (s) => { const { kvSet } = await import("./js/db.js"); await kvSet("state", JSON.parse(s)); }, st); await dp.reload(); await dp.waitForTimeout(800);
await dp.screenshot({ path: out + "d01-home.png", fullPage: true });
await dp.goto(U + "#/progress"); await dp.waitForTimeout(600); await dp.screenshot({ path: out + "d02-progress.png", fullPage: true });
await dp.goto(U + "#/workout"); await dp.waitForTimeout(600); await dp.screenshot({ path: out + "d03-workout.png", fullPage: true });
await dp.emulateMedia({ colorScheme: "light" });
await dp.goto(U + "#/equipment"); await dp.waitForTimeout(600); await dp.screenshot({ path: out + "d04-equip.png", fullPage: true });
await dp.goto(U + "#/plan"); await dp.waitForTimeout(600); await dp.screenshot({ path: out + "d05-plan.png", fullPage: true });
console.log("ERRORS", errors);
await browser.close();
