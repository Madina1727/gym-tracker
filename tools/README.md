# Tools (not published)

- `tests/test.mjs` – end-to-end browser test with screenshots (Playwright from ~/Desktop/wayu-korea/node_modules; app must run on :5190).
- `tests/icons.mjs`, `tests/splash.mjs` – make PWA/Android icons and Android splash images.
- `tests/sync.mjs` – checks the sync merge logic and the Supabase connection.
- `tests/imp.mjs`, `tests/live*.mjs` – import tests (local and live site).
- `fiat-gym/` – how the Fiat Gym Sinchon equipment file was built from blog.naver.com/maengmon:
  1. download post list (m.blog.naver.com/api/blogs/maengmon/post-list?categoryNo=0&itemCount=30&page=N, Referer m.blog.naver.com)
  2. posts: m.blog.naver.com/PostView.naver?blogId=maengmon&logNo=<id> → `parse.py` (text + image order)
  3. images (`imgs.json` = index → post → URL, add ?type=w800) → contact sheets (`sheets.mjs`, `grid.mjs`)
  4. `crop.py` cuts machines out of the "coming soon" cards → `crop/`
  5. `pack.py` writes www/inbox/fiat-gym.equipment.json (38 machines, 48 photos). Needs the downloaded img/ folder again (step 3) for the uncropped photos.
The gym's photos must never be committed: www/inbox/, *.equipment.json and tools/fiat-gym/ are gitignored.
