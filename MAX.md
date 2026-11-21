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

## Notes kept from Toby
`TOBY.md` lists every Toby build (1 to 45) and what it added; it is kept as the history of the engine Max is built on.

## Tests
`npm test` (436 pass, 1 skipped at Max build 1), `npm run test:team`, `npm run verify:public`.
