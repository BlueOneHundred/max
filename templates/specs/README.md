# Platform spec sheets (Max's team)

One sheet per platform. Each platform bot owns its sheet, follows it exactly, and keeps it current.

| Sheet | Owner bot |
|---|---|
| facebook.md | Facebook Bot |
| instagram.md | Instagram Bot |
| tiktok.md | TikTok Bot |
| linkedin.md | LinkedIn Bot |
| x.md | X Bot |

## How every sheet is laid out
1. **Formats**: one ```json block (the tools read it; keep it valid JSON). Each format has an `id`, a `use`, the canvas in pixels, the **safe zone** in pixels, and video rules where they apply.
2. **Copy limits**: text lengths for the ad fields.
3. **Carousels** and **Video and sound**: the platform's rules.
4. **What Max's packs make here**: the files a pack delivers for this platform. The "pack" line in the Formats block says the same thing for the tools (ad, adVideo, carousel, carouselVideo: lists of format ids); keep the two in step.
5. **Sources**: every number has a source and the date it was checked. "Official" means the platform's own page. "Quoted" means a page that quotes the platform's own guide, used only where the official page blocks automatic reading; these are marked to re-check.
6. **Open checks**: anything not yet confirmed.

## Safe zone fields (pixels, on the format's own canvas)
- `top`, `bottom`, `left`, `right`: margins to keep clear of text, logos, faces and the offer.
- `blocks`: extra rectangles to keep clear, as `[x, y, width, height]` (for example TikTok's button column).
- `source`: "platform" (the platform publishes it) or "house" (the platform shows no buttons on the picture; this is our own margin so nothing sits on the very edge).

## Keeping sheets current (each platform bot)
- Re-check every line against its source on the **first workday of each month**, and whenever the platform announces a change.
- Change a number only with a new source and date. Write what changed under "## Changes" at the bottom of the sheet and in "## For Max".
- Never guess a number. If a source is gone or unclear, keep the old number and say so in "## For Max".

Checked: 2026-11-21 (Hanoi), by Claude, for build step 1.
