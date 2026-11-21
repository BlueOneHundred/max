# Max

Max is Tavin's ad-pack team of bots for Blue One Hundred. It is a separate app from Toby: a copy of **Toby build 45** (BlueOneHundred/toby, tag `toby-v0.23.2-build45`, commit 29fb22d), which is itself built on the open-source Gratis community edition (MIT licence; see LICENSE, which must stay in place).

Max and Toby never share anything: different app, app ID, data folder, team folder, bots, schedules and memory. Toby's repo is never changed from here.

## What's different from Toby build 45 (Max build 1, 21 Nov 2026)
- **Name and identity** (`edition.json`, `package.json`, `electron-builder.cjs`): name Max, data folder `%APPDATA%\Max`, app ID `com.blueonehundred.max`, installer `Max-<version>-win-x64.exe`, Start menu and desktop shortcut "Max", green "M" icon (`assets/max-icon.png`).
- **Team folder** (`src/main.cjs`, `src/team-folder.mjs`): `Desktop\Max\Team` (or `MAX_TEAM_FOLDER`). Same tools as Toby: `list_team_files`, `read_team_file`, `write_team_file`, `append_team_file`, `copy_to_team`, `copy_from_team`.
- **Lead bot is "Max"**: every "Toby" in the app and tests is now "Max" (on screen, in bot tools, and where the app looks up the lead bot by name).
- **Toby's creator automations are off** (`edition.json` "features", read by `src/pipeline.mjs`): `creatorLog`, `creatorsSafetyNet` and `autoPick` are false, so Max never writes creator logs, never sends the 08:15 creators second try and never auto-picks creators. The decisions archive, package runs, gates, run lines and schedules work as in Toby. With no "features" given (as in Toby), everything is on.
- **Sidebar order** (`src/sidebar-items.mjs` `TEAM_ORDER`): Max, Lead Finder, Fact Finder, Ad Writer, Facebook Bot, Instagram Bot, TikTok Bot, LinkedIn Bot, X Bot, Rule Checker, Visual Check, Page Builder, Outreach Writer.
- **Windows build**: `.github/workflows/max-windows.yml` (Actions tab, "Build Max for Windows", Run workflow). Releases are tagged `max-v<version>-build<run>`.
- Toby's book, app, carousel and reel tools are still inside (unused by Max's team for now). Max's own tools (ads, carousels and videos per platform, with safe-zone self-checks) come in later builds.

## Max build 2 (21 Nov 2026): the ad-pack tools
- **Spec sheets drive everything.** `src/pack-maker.mjs` `parseSpec` reads the ```json Formats block of `specs/<platform>.md` in the team folder (canvas sizes, safe zones in pixels, `blocks` such as TikTok's button column, and the `pack` line: which formats go in `ad`, `adVideo`, `carousel`, `carouselVideo`). A broken sheet is refused with the reasons. Starting copies of all 5 sheets are in `templates/specs/` (checked 21 Nov 2026, pack lists approved by Tavin, decision 47).
- **Three tools for the platform bots** (`src/pack-tools.mjs`, registered in `src/agent-tools.mjs` next to the motion tools; bots need Files on):
  - `make_pack_ad`: one ad in every `ad` format (JPEG stills) and every `adVideo` format (an 8 s video of the still with a slow zoom, for TikTok).
  - `make_pack_carousel`: still carousel cards in every `carousel` format; adds "1 / 5", "Swipe to see how" and "Next" itself.
  - `make_pack_video`: the carousel as a 15 s video in every `carouselVideo` format. House rules from session 3: title card left out (keepTitleCard to keep it), card 1's words on screen from frame 1, top label and business name fixed, swipe on feed shapes and dissolve on 9:16, no sound.
  - Files go to `<folder>/<platform>/`; each call writes `<name>-check.md` (Result: PASSED or FAILED, one row per file, notes) and returns passed, files and toFix.
- **One layout for every shape** (`frameHtml`): photo full frame, top label, words at the bottom on a colour fade (on the left for 16:9). Words sit inside the larger of the platform's safe zone and a small house margin, and the word column stops before any button column. On 9:16 the words are 20% larger. Fonts: Inter and Archivo Black, now bundled (`src/book-fonts/`, OFL, Latin subset).
- **Self-check in every tool** (`PACK_JS`): after drawing, every label, word line, badge and the business name is measured: inside the safe zone, clear of blocks, nothing cut, no overlaps, no lone last word (it first tries rebalancing the lines), fonts and photo loaded; stills also get the contrast check from the carousel tool. The main line shrinks (to 70% at most) if it would collide with the top label. Video cards are measured at their fullest moment.
- **Readable accent**: if white words on the brand's accent colour are under 4.5:1, badges and step circles use a deeper shade of the same colour (noted in the check file). Small photos (under 75% of the widest format) are noted as possibly soft.
- Tests: `test/max-pack.test.mjs` (13 tests); full suite 449 pass, 1 skipped.

## Max builds 3 to 5 (21 Nov 2026)
- Build 3: the big number line ("20-YEAR") never wraps; it shrinks to fit.
- Build 4: the business name sits under the words, on the left, on wide frames and wherever a button column narrows the words (TikTok); feed shapes keep it bottom right. New check "floating".
- Build 5: make_pack_ad (adVideo) and make_pack_video also save `<file>-sheet.jpg`, a contact sheet of every card at its fullest, so Visual Check can look at videos.
- `team/prompts/`: Max's shared rules and bot prompts (first 7 bots), the platform-bot template and generator, build.py (assembles `built/<bot>.txt`) and the setup sheet. The working copy is `Desktop\Max\prompts\`.

## Notes kept from Toby
`TOBY.md` lists every Toby build (1 to 45) and what it added; it is kept as the history of the engine Max is built on.

## Tests
`npm test` (436 pass, 1 skipped at Max build 1; 449 pass, 1 skipped at Max build 2), `npm run test:team`, `npm run verify:public`.
