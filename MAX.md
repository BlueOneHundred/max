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

## Max build 7 (22 Nov 2026): carousel videos for busy photos
- **Video size.** JJBM's carousel video (busy photos: branches, leaves, gravel) came out at 24 MB on Facebook 4:5, and the app refused to save any file over 20 MB, so Facebook Bot's `make_pack_video` failed twice. The encoder keeps CRF 18 but now caps the bitrate at 8 Mbit/s (`VIDEO_MAXRATE`, `VIDEO_BUFSIZE` in `src/pack-tools.mjs`): JJBM's 15 s videos are 13.4 to 13.9 MB, still sharp (platforms re-encode uploads to far less). `WorkspaceFiles.writeBytes` takes an optional `{maxFileBytes}` (at most 100 MB); only finished pack videos use it, everything else keeps the 20 MB limit.
- **Top label in videos.** The top label stays fixed only when every card has the same one (Advanced Roofing). When labels differ (JJBM: TREE REMOVAL, LAWN CARE, LANDSCAPING, HARDSCAPING), each card keeps its own label and it moves with its card, so a label never sits over a photo of other work. The business name always stays fixed.
- Tests: 3 new; full suite 455 pass, 1 skipped.

## Max build 8 (22 Nov 2026): lone long words and the counter pill
- **Lone last word.** The self-check counted a word alone on the last line only if it had 6 letters or fewer, so JJBM's Ad B 9:16 sub ended with "Connecticut." alone and passed (Instagram Bot caught it by eye). Now a single last word counts when its line is under half as wide as the line above, whatever its length; the tool rebalances the lines first (Ad B now reads "Over a decade of tree and / landscape work across Connecticut."). Two even lines such as "Masonry and / hardscaping." still pass.
- **"1 / 5" counter**: a solid pill in the brand's panel colour (92%), with a soft shadow. The old 60% black vanished on dark branches (JJBM card 1).
- Checked on JJBM (all 5 platforms, every ad and carousel: all PASSED) and Advanced Roofing (Facebook, Instagram, LinkedIn, X: all PASSED). Tests: 1 new; full suite 456 pass, 1 skipped.

## Max build 9 (22 Nov 2026): words on the right for wide shapes
- On 16:9 the words and dark fade always sat on the left, so a photo with its subject on the left lost it (JJBM's tree-work card: the climber was a dim shape; Visual Check failed both 16:9 videos). An ad or card may now say `side: "right"`: on wide shapes only, the words, the fade and the business name move to the right. Other shapes ignore it.
- In a video, the business name stays fixed only when every card uses the same side; otherwise each card carries its own name under its words (as build 7 did for labels). The "floating" check also accepts a name lined up with the words.
- Checked: JJBM LinkedIn videos with the tree-work card on the right (climber clear; all PASSED); JJBM and Advanced Roofing stills unchanged and PASSED. Tests: 1 new; full suite 457 pass, 1 skipped.

## Max build 10 (23 Nov 2026): the 16:9 fade only behind the words
- **Build 9 is withdrawn** (do not install it). Moving one card's words to the right breaks the flow of the whole video (Tavin, 22 Nov 12:31: a video or carousel is one sequence; every card keeps the same layout).
- On 16:9 the dark fade now comes from the bottom-left corner only, behind the words, the same on every card; the top-left and the right of the photo stay bright. Before, a band covered the left 74% of the frame and hid subjects on the left (JJBM's tree-work climber). One CSS line in src/pack-maker.mjs (`.wide .shade`). Other shapes are unchanged.
- Build 9's `side` option is removed completely: the pack-tools schema, the `right` class, the `.wide.right` CSS, the video's mixed-sides business name and the build 9 test. Build 9's change to the "floating" check is also reverted (it was only needed for words on the right), so the code is build 8 plus the new fade.
- Checked with the real make_pack_video on JJBM and Advanced Roofing, LinkedIn and X (1:1, 4:5, 16:9, 9:16): all 12 videos PASSED, contrast included; climber clear. Advanced Roofing's long card 2 sub now ends over lighter tiles: still readable and passes contrast. Tests: 1 new (build 10), build 9 test removed; full suite 457 pass, 1 skipped.

## Notes kept from Toby
`TOBY.md` lists every Toby build (1 to 45) and what it added; it is kept as the history of the engine Max is built on.

## Tests
`npm test` (436 pass, 1 skipped at Max build 1; 449 pass, 1 skipped at Max build 2), `npm run test:team`, `npm run verify:public`.
