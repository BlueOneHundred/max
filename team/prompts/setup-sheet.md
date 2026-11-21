# Max: setting up the first 7 bots (build step 3)

Written 21 Nov 2026 for Max build 4. These 7 bots use the new making tools. The other 6 (Max himself, Lead Finder, Fact Finder, Ad Writer, Page Builder, Outreach Writer) come after the first test.

## For each bot, in the Max app
1. Click **+**, give the bot its **name** exactly as below (the sidebar puts them in team order by name), and an avatar if you like.
2. Open the bot's **settings** and replace everything in **System prompt** with the whole of its file from `Desktop\Max\prompts\built\` (open it in Notepad, Ctrl+A, Ctrl+C, then paste).
3. **User prompt template**: leave it as `{{message}}`.
4. **Capabilities**: switch on what the table says, and switch everything else off.
5. **Model**: the same as Toby's specialists (Opus).
6. **No schedule yet.** While we test, the bots only work when you (or the test) message them.

| # | Name | Paste this file | Files | Web | Computer | Connected apps |
|---|---|---|---|---|---|---|
| 1 | Facebook Bot | built\facebook-bot.txt | on | on | off | off |
| 2 | Instagram Bot | built\instagram-bot.txt | on | on | off | off |
| 3 | TikTok Bot | built\tiktok-bot.txt | on | on | off | off |
| 4 | LinkedIn Bot | built\linkedin-bot.txt | on | on | off | off |
| 5 | X Bot | built\x-bot.txt | on | on | off | off |
| 6 | Rule Checker | built\rule-checker.txt | on | off | off | off |
| 7 | Visual Check | built\visual-check.txt | on | off | off | off |

Why: **Files** gives each bot the team folder (`Desktop\Max\Team`) and the making tools. **Web** lets a platform bot re-check its spec sheet each month. Nobody needs the computer or your connected apps.

## Check after setting up
- Each bot's sidebar position: Facebook Bot, Instagram Bot, TikTok Bot, LinkedIn Bot, X Bot, Rule Checker, Visual Check.
- Message any platform bot: "List the files in specs/ and tell me your pack line." It should name its own sheet and its formats. That proves Files and the team folder work.

## What happens next (the first test)
Claude prepares JJBM Landscaping in the team folder (its fact file, photos, brand and ads.json, from the session 1 pack), standing in for Fact Finder and Ad Writer, which are not built yet. Then, one message at a time: Rule Checker checks it, the 5 platform bots make their files, and Visual Check looks at everything. We compare the result with the hand-made JJBM pack and fix the prompts before building the other 6 bots.

## Changing a bot later
Edit its file in `Desktop\Max\prompts\` (the 5 platform bots come from `platform-bot.template.md`), run `build.py` (Claude does this), and paste the new `built\` file over the old system prompt.
