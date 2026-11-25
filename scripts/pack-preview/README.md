# Pack preview (Claude's workspace tools, not part of the app)

Used in session 3 (21 Nov 2026) to see Max's pack layouts and run the real pack tools before an app build.
They expect this repo cloned at /home/claude/max, `npm ci --ignore-scripts` and `npm rebuild ffmpeg-static`, Google Chrome at /usr/bin/google-chrome, and spec sheets in ./specs next to where you run them (copy templates/specs).

- `harness.mjs <data.json> <photoDir> <outDir> [platform...] [--video]`: draws every pack format for the platforms with the same page code and self-check as the app (Chrome stands in for Electron). data.json is like ar.json (photo names relative to photoDir) or an ads.json (team-folder paths, photoDir = the team folder root).
- `tooltest.mjs <team root>`: runs the real make_pack_ad / make_pack_carousel / make_pack_video handlers with Chrome stand-ins for renderPage and renderFrames.
- `sheet.py <out.jpg> <images...>`: a contact sheet for looking at many files at once.
- `ar.json`: Advanced Roofing's pack data (session 1 to 3). `jjbm-ads-test1.json`: JJBM's ads.json as first prepared for test run 1 (before Rule Checker's fixes).
- `pagetest.mjs <team root> [business]` (build 12): runs the real make_pack_page with a Chrome stand-in for renderPage and prints its result.
- `clicktest.mjs <index.html>` (build 12): opens a made page on desktop and phone, clicks every platform tab and shape, plays every video, steps through every carousel card and reports anything that did not show, play or fit.
- `pagecheck.mjs <page folder>` (build 13): like clicktest.mjs, but serves the folder over http, adds a wide screen (1920), and checks what a person sees: every picture's drawn shape against the file's own shape (a 9:16 poster stretched on desktop failed this in build 12), every jump link, every file link, and sideways scrolling after all the clicks. Still missing: a check that a video visibly moves.
- `wowtest.mjs <team root> <ads.json>` (build 14): runs the real make_wow_ad with a Chrome stand-in for renderPage (PNG too). ads.json is {folder, brand, ads}.
- `electron-one.cjs` (build 20): renders one page with the app's own renderPage inside real Electron (needs `node node_modules/electron/install.js` and xvfb-run). Use it to check pictures the way the app draws them.
