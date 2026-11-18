// Local storage in IndexedDB: one state document ("kv") plus photo blobs ("photos").
const DB = "gym-tracker", VER = 1;
let dbp;
function open() {
  if (!dbp) dbp = new Promise((ok, bad) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((ok, bad) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => bad(t.error);
  });
}
export const kvGet = (k) => tx("kv", "readonly", (s) => s.get(k));
export const kvSet = (k, v) => tx("kv", "readwrite", (s) => s.put(v, k));
export const photoGet = (k) => tx("photos", "readonly", (s) => s.get(k));
export const photoSet = (k, v) => tx("photos", "readwrite", (s) => s.put(v, k));
export const photoDel = (k) => tx("photos", "readwrite", (s) => s.delete(k));
export const photoKeys = () => tx("photos", "readonly", (s) => s.getAllKeys());
