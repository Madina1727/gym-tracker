import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/Users/madina/Desktop/wayu-korea/package.json");
const { chromium } = require("playwright");
const dir = "/Users/madina/Desktop/gym-tracker/android/app/src/main/res/";
const list = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => l.split(" "));
const b = await chromium.launch(); const p = await b.newPage();
for (const [f, w, h] of list) {
  const s = Math.round(Math.min(+w, +h) * 0.28);
  await p.setViewportSize({ width: +w, height: +h });
  await p.setContent(`<body style="margin:0;background:#F3F4F1;display:grid;place-items:center;height:100vh"><svg width="${s}" height="${s}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111412"/><g fill="#CFF44A"><rect x="96" y="236" width="320" height="40" rx="10"/><rect x="132" y="160" width="44" height="192" rx="12"/><rect x="336" y="160" width="44" height="192" rx="12"/><rect x="92" y="196" width="28" height="120" rx="10"/><rect x="392" y="196" width="28" height="120" rx="10"/></g></svg></body>`);
  await p.screenshot({ path: dir + f });
}
await b.close(); console.log("splash ok", list.length);
