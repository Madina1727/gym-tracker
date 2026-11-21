import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/Users/madina/Desktop/wayu-korea/package.json");
const { chromium } = require("playwright");
const res = "/Users/madina/Desktop/gym-tracker/android/app/src/main/res/";
const mark = `<g fill="#CFF44A"><rect x="96" y="236" width="320" height="40" rx="10"/><rect x="132" y="160" width="44" height="192" rx="12"/><rect x="336" y="160" width="44" height="192" rx="12"/><rect x="92" y="196" width="28" height="120" rx="10"/><rect x="392" y="196" width="28" height="120" rx="10"/></g>`;
const b = await chromium.launch(); const p = await b.newPage();
const shot = async (html, s, path) => { await p.setViewportSize({ width: s, height: s }); await p.setContent(`<body style="margin:0">${html}</body>`); await p.screenshot({ path, omitBackground: true }); };
for (const [d, s, f] of [["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216], ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432]]) {
  await shot(`<svg width="${s}" height="${s}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111412"/>${mark}</svg>`, s, `${res}mipmap-${d}/ic_launcher.png`);
  await shot(`<svg width="${s}" height="${s}" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#111412"/>${mark}</svg>`, s, `${res}mipmap-${d}/ic_launcher_round.png`);
  // adaptive foreground: 108dp canvas, mark inside the 66dp safe zone
  await shot(`<svg width="${f}" height="${f}" viewBox="-160 -160 832 832">${mark}</svg>`, f, `${res}mipmap-${d}/ic_launcher_foreground.png`);
}
await b.close(); console.log("icons ok");
