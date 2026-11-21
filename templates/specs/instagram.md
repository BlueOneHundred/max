# Instagram: spec sheet

Owner: **Instagram Bot**. Checked: **2026-11-21** (Hanoi). Next check: first workday of December 2026.
Instagram ads run from Meta Ads Manager, like Facebook, but Instagram is its own job with its own files. Sizes depend on where the ad shows: Feed (and Explore), Stories, Reels.

## Formats
```json
{
  "platform": "instagram",
  "checked": "2026-11-21",
  "pack": {"ad": ["feed-4x5", "reels-stories-9x16"], "adVideo": [], "carousel": ["carousel-1x1"], "carouselVideo": ["feed-4x5", "reels-stories-9x16"]},
  "formats": [
    {"id": "feed-4x5", "kind": ["image", "video"], "use": "Instagram Feed, Profile Feed and Explore (Meta's recommended shape).",
     "width": 1440, "height": 1800,
     "safe": {"top": 72, "bottom": 72, "left": 72, "right": 72, "blocks": [], "source": "house"}},
    {"id": "reels-stories-9x16", "kind": ["image", "video"], "use": "Instagram Reels and Instagram Stories (full screen). Built to the Reels safe zone, the stricter of the two.",
     "width": 1440, "height": 2560,
     "safe": {"top": 358, "bottom": 896, "left": 86, "right": 86, "blocks": [], "source": "platform"}},
    {"id": "carousel-1x1", "kind": ["image", "video"], "use": "Each Feed carousel card (2 to 10 cards). Square: 4:5 cards get cropped.",
     "width": 1080, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}}
  ],
  "video": {"files": ["mp4", "mov"], "max_mb": 4096, "fps": 30, "target_s": 15, "min_s": 5,
            "max_s_by_placement": {"feed": 3600, "stories": 3600, "reels": 900}},
  "image": {"files": ["jpg", "png"], "max_mb": 30}
}
```
- Safe zone for 9:16: keep the **top 14%, bottom 35% and 6% on each side** clear (1440 x 2560: 358, 896, 86 px; 1080 x 1920: 269, 672, 65 px). With a **disclaimer**, keep the bottom **40%** clear.
- A 9:16 video in Instagram Feed follows the same safe zone as Reels and Stories.
- Stories: videos under 35 seconds play in full; videos of 15 seconds or more may be split into cards. Our 15-second videos play in full.
- Instagram loops every video while it is on screen.

## Copy limits (recommended)
| Where | Primary text | Headline |
|---|---|---|
| Feed and Explore | 125 (up to 30 hashtags) | 40 |
| Stories | 125 | 40 |
| Reels | about 40 to 44 | 40 |
| Carousel | 125 | 40 per card |

## Carousels
- 2 to 10 cards, square (1:1), JPG or PNG up to 30 MB, or MP4/MOV video cards.

## Video and sound
- MP4 or MOV, H.264, fixed frame rate (we use 30 fps), up to 4 GB.
- Captions on screen always. Reels default to sound on, and sound is recommended.
- **Reels ads must not use licensed music**: use original audio, royalty-free music, or Meta's Sound Collection (rule M3).

## What Max's packs make here (the "pack" line in Formats is what the tools follow; keep the two the same)

### Pack list (approved by Tavin 2026-11-21, decision 47)
| Item | Formats |
|---|---|
| Each still ad | feed-4x5, reels-stories-9x16 |
| Carousel | carousel-1x1 (5 cards) |
| Carousel video | feed-4x5 (swipe), reels-stories-9x16 (dissolve) |
| Lead-form image | Meta's form image size (to confirm in the next check) |

## Sources (checked 2026-11-21)
- Feed 4:5 at 1440 x 1800 recommended, Stories and Reels 1440 x 2560: Meta Ads Guide, **quoted** by lilachbullock.com (instagram-ad-size, instagram-video-ads) and Jon Loomer.
- 9:16 safe zone and disclaimer 40%; 9:16 in Feed follows the Reels guidance: Meta help pages, **quoted** by admanage.ai, sirency.com and lilachbullock.com.
- Lengths (Feed and Stories 60 min, Reels 15 min; Stories under 35 s plays in full): Meta Ads Guide, **quoted** by Jon Loomer (jonloomer.com/meta-video-ad-length-requirements) and lilachbullock.com.
- No licensed music in Reels ads: Meta Ads Guide, **quoted** by lilachbullock.com.
- Copy limits: Meta Ads Guide, **quoted** by Strike Social, QuickFrame and lilachbullock.com.
- Meta's own pages block automatic reading: re-check in Ads Manager (Safe zone guardrail on) at the first real upload.

## Open checks
1. Lead-form (Instant Form) image size.
2. Reels primary text: sources say 40 or 44.

## Changes
- 2026-11-21: sheet created.

## For Max
- The pack list above was approved by Tavin on 2026-11-21 (decision 47).
