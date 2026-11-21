import { createRequire } from "node:module";
const require = createRequire("/Users/madina/Desktop/wayu-korea/package.json");
const { chromium } = require("playwright");
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const U = "https://madina1727.github.io/gym-tracker/";
await p.goto(U + "?r=" + Date.now()); await p.waitForTimeout(1500); await p.fill("[data-name]", "T"); await p.click("[data-go]"); await p.waitForTimeout(500);
await p.goto(U + "#/equipment/import/http://localhost:5190/inbox/fiat-gym.equipment.json"); await p.waitForTimeout(8000);
console.log(await p.evaluate(async () => (await import("./js/store.js")).S.state.equipment.length), errs.slice(0, 3)); await b.close();
