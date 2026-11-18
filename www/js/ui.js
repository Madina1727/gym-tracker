// Small UI helpers: escaping, icons, sheets, toasts, confirm, photos in the page.
import { photoGet, photoSet, photoDel } from "./db.js";
import { uid } from "./store.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const icon = (name, cls = "") => `<i data-lucide="${name}" class="ic ${cls}" aria-hidden="true"></i>`;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function paint(root = document) {
  window.lucide?.createIcons({ attrs: { "stroke-width": 2 }, nameAttr: "data-lucide", root });
  hydratePhotos(root);
}

/* ---------- toast ---------- */
export function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg; el.setAttribute("role", "status");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ---------- sheet (bottom sheet on phones, dialog on desktop) ---------- */
export function sheet(html, { onMount, wide } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("no-scroll");
  const close = () => { wrap.classList.remove("open"); document.body.classList.remove("no-scroll"); setTimeout(() => wrap.remove(), 200); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
  paint(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));
  onMount?.(wrap.firstElementChild, close);
  setTimeout(() => wrap.querySelector("[autofocus]")?.focus(), 60);
  return close;
}
export function confirmBox(text, { ok = "Delete", danger = true } = {}) {
  return new Promise((res) => {
    let answered = false;
    const close = sheet(`<div class="sheet-body"><p class="confirm-text">${esc(text)}</p>
      <div class="row end gap"><button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(ok)}</button></div></div>`,
      { onMount: (el, c) => el.querySelector("[data-yes]").onclick = () => { answered = true; res(true); c(); } });
    const obs = new MutationObserver(() => { if (!document.body.contains(document.querySelector(".sheet-wrap")) && !answered) { res(false); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    void close;
  });
}

/* ---------- photos ---------- */
const urls = new Map();
export const photoHooks = { fetchMissing: null, uploaded: null };
/** Shrinks a picked image (max 1600 px, JPEG) and stores it. Returns the photo id. */
export async function storePhoto(file) {
  const img = await createImageBitmap(file).catch(() => null);
  let blob = file;
  if (img) {
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  }
  const id = uid();
  await photoSet(id, blob);
  photoHooks.uploaded?.(id, blob);
  return id;
}
export async function photoURL(id) {
  if (urls.has(id)) return urls.get(id);
  let blob = await photoGet(id);
  if (!blob && photoHooks.fetchMissing) blob = await photoHooks.fetchMissing(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}
export async function deletePhoto(id) { await photoDel(id); urls.delete(id); }
export function photoImg(id, cls = "", alt = "") { return `<img class="${cls}" data-photo="${esc(id)}" alt="${esc(alt)}" loading="lazy">`; }
export function hydratePhotos(root = document) {
  $$("img[data-photo]:not([src])", root).forEach(async (img) => {
    const u = await photoURL(img.dataset.photo);
    if (u) img.src = u; else img.classList.add("missing");
  });
}
/** Opens the camera or file picker; resolves with stored photo ids. */
export function pickPhotos({ camera = false, multiple = true } = {}) {
  return new Promise((res) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = multiple;
    if (camera) inp.capture = "environment";
    inp.onchange = async () => { const ids = []; for (const f of inp.files) ids.push(await storePhoto(f)); res(ids); };
    inp.click();
  });
}
export function viewPhoto(id, caption = "") {
  sheet(`<div class="viewer">${photoImg(id, "viewer-img")}<div class="row between"><span class="muted">${esc(caption)}</span><button class="btn ghost" data-close>Close</button></div></div>`, { wide: true });
}
/** Number input value or null. */
export const val = (el) => (el?.value === "" || el == null ? null : el.type === "number" ? +el.value : el.value);
