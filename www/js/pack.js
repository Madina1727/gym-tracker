// Equipment packs: a JSON file with machines and their photos, added to the library without replacing anything.
import { S, save, uid, now } from "./store.js";
import { photoSet } from "./db.js";
import { photoHooks } from "./ui.js";
import { KINDS } from "./kinds.js";

const key = (s) => String(s || "").trim().toLowerCase();
/** Adds the pack's machines. Machines whose name is already in the library are skipped. Returns counts. */
export async function importPack(pack) {
  if (pack?.app !== "gym-tracker" || pack.kind !== "equipment-pack" || !Array.isArray(pack.equipment)) throw new Error("This is not a Gym Tracker equipment file.");
  const have = new Set(S.state.equipment.map((e) => key(e.name)));
  let added = 0, skipped = 0, photos = 0;
  for (const e of pack.equipment) {
    if (!e.name || have.has(key(e.name))) { skipped++; continue; }
    const ids = [];
    for (const d of e.photos || []) {
      const blob = await (await fetch(d)).blob();
      const id = uid();
      await photoSet(id, blob);
      photoHooks.uploaded?.(id, blob);
      ids.push(id); photos++;
    }
    S.state.equipment.push({ id: uid(), name: e.name, kind: KINDS[e.kind] ? e.kind : "machine", muscles: e.muscles || [], instructions: e.instructions || "", settings: e.settings || "",
      favorite: false, photos: ids, defaultTarget: e.defaultTarget || {}, createdAt: now(), updatedAt: now() });
    have.add(key(e.name)); added++;
  }
  save();
  return { added, skipped, photos };
}
