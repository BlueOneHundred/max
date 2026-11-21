# Facebook: spec sheet

Owner: **Facebook Bot**. Checked: **2026-11-21** (Hanoi). Next check: first workday of December 2026.
Facebook ads run from Meta Ads Manager. Sizes depend on **where** the ad shows (feed, Stories, Reels), not on the app. Instagram has its own sheet (instagram.md) and its own bot.

## Formats
```json
{
  "platform": "facebook",
  "checked": "2026-11-21",
  "pack": {"ad": ["feed-4x5", "feed-1x1", "reels-stories-9x16"], "adVideo": [], "carousel": ["carousel-1x1"], "carouselVideo": ["feed-4x5", "feed-1x1", "reels-stories-9x16"]},
  "formats": [
    {"id": "feed-4x5", "kind": ["image", "video"], "use": "Facebook Feed on phones (Meta's recommended feed shape). Not shown on desktop.",
     "width": 1440, "height": 1800,
     "safe": {"top": 72, "bottom": 72, "left": 72, "right": 72, "blocks": [], "source": "house"}},
    {"id": "feed-1x1", "kind": ["image", "video"], "use": "Facebook Feed on desktop and phones (desktop shows 1:1, not 4:5).",
     "width": 1440, "height": 1440,
     "safe": {"top": 72, "bottom": 72, "left": 72, "right": 72, "blocks": [], "source": "house"}},
    {"id": "reels-stories-9x16", "kind": ["image", "video"], "use": "Facebook Reels and Facebook Stories (full screen). Built to the Reels safe zone, the stricter of the two.",
     "width": 1440, "height": 2560,
     "safe": {"top": 358, "bottom": 896, "left": 86, "right": 86, "blocks": [], "source": "platform"}},
    {"id": "carousel-1x1", "kind": ["image", "video"], "use": "Each carousel card (2 to 10 cards). Meta crops 4:5 cards to 1:1, so cards are square.",
     "width": 1080, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}}
  ],
  "video": {"files": ["mp4", "mov"], "max_mb": 4096, "fps": 30, "target_s": 15, "min_s": 5,
            "max_s_by_placement": {"feed": 14460, "stories": 120, "reels": null}},
  "image": {"files": ["jpg", "png"], "max_mb": 30}
}
```
- Safe zone for 9:16: keep the **top 14%, bottom 35% and 6% on each side** clear (on 1440 x 2560: 358, 896 and 86 px; on 1080 x 1920: 269, 672 and 65 px). Stories alone needs only about 20% at the bottom, but one 9:16 file serves both Stories and Reels, so it is built to Reels.
- If the ad carries a **disclaimer**, keep the **bottom 40%** clear instead (quoted from Meta's safe zone help page).
- Feed and carousel have no buttons on the picture; the "house" margin (5% of the width) only keeps text off the very edge.
- Our videos are **15 seconds** (decision 36; Meta recommends 6 to 15). At least 5 seconds lets a video run in every Meta placement.

## Copy limits (recommended lengths; longer text gets cut off)
| Where | Primary text | Headline | Description |
|---|---|---|---|
| Feed (image or video) | 125 (50 to 150 works best) | 27 | 27 |
| Stories | 125 | 40 | none |
| Reels | about 40 | about 55 | none |
| Carousel (per card) | 80 | 45 | 18 |

## Carousels
- 2 to 10 cards, each with its own headline and link. Square cards (1:1); 4:5 cards get cropped.
- Images JPG or PNG up to 30 MB; video cards MP4 or MOV up to 4 GB.

## Video and sound
- MP4 or MOV, H.264, fixed frame rate (we use 30 fps), up to 4 GB.
- **Captions on screen always**: Facebook Reels does not add captions by itself. Sound is recommended (Meta's Reels page: 9:16 video with audio and key messages in the safe zone cost 34.5% less per result than image ads).
- Music in ads: only original, royalty-free, or Meta Sound Collection tracks; no licensed (copyrighted) music (rule M3).

## What Max's packs make here (the "pack" line in Formats is what the tools follow; keep the two the same)

### Pack list (approved by Tavin 2026-11-21, decision 47)
| Item | Formats |
|---|---|
| Each still ad | feed-4x5, feed-1x1, reels-stories-9x16 |
| Carousel | carousel-1x1 (5 cards) |
| Carousel video | feed-4x5 (swipe), feed-1x1 (swipe), reels-stories-9x16 (dissolve) |
| Lead-form image | Meta's form image size (to confirm in the next check) |

## Sources (checked 2026-11-21)
- Feed 4:5 recommended, 1:1 accepted; 4:5 mobile only, 1:1 desktop and mobile; 1440 x 1440 / 1440 x 1800 recommended: Meta Ads Guide, **quoted** by Hootsuite (blog.hootsuite.com/facebook-ad-sizes), Jon Loomer (jonloomer.com/qvt/meta-recommends-4x5-aspect-ratio) and Shopify (shopify.com/blog/facebook-ad-sizes).
- Carousel cards cropped to 1:1: firstpier.com/resources/facebook-ad-image-size (**quoted**).
- 9:16 safe zone 14% / 35% / 6%, bottom 40% with a disclaimer, 1440 x 2560: Meta Reels ad specs and Safe Zone help page, **quoted** by admanage.ai (checked against Meta's diagram 29 Oct 2026), adnova.ai, sirency.com and billo.app. Stories 20% bottom: adsuploader.com.
- Lengths (feed 241 min, Stories 2 min, Reels no maximum; 5 s minimum for all placements): Meta Ads Guide **quoted** by Jon Loomer (jonloomer.com/meta-video-ad-length-requirements) and Metricool.
- Copy limits: Meta Ads Guide **quoted** by Shopify, Buffer and Sprout Social.
- 34.5% figure: Meta's Reels ads page, **quoted** by knowlify.com and predis.ai.
- Meta's own Ads Guide and Business Help pages block automatic reading, so every line above is **quoted**: re-check in Ads Manager (Safe zone guardrail on) at the first real upload.

## Open checks
1. Lead-form (Instant Form) image size.
2. Confirm Reels primary text and headline lengths (sources say 40 or 44, and 55).

## Changes
- 2026-11-21: sheet created.

## For Max
- The pack list above was approved by Tavin on 2026-11-21 (decision 47).
