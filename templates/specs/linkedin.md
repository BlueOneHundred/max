# LinkedIn: spec sheet

Owner: **LinkedIn Bot**. Checked: **2026-11-21** (Hanoi). Next check: first workday of December 2026.
LinkedIn ads (Sponsored Content) run from LinkedIn Campaign Manager and show in the feed on desktop and phones. Upright (vertical) ads show **on phones only**.

## Formats
```json
{
  "platform": "linkedin",
  "checked": "2026-11-21",
  "pack": {"ad": ["image-1x1", "image-4x5"], "adVideo": [], "carousel": ["carousel-1x1"], "carouselVideo": ["video-1x1", "video-4x5", "video-16x9"]},
  "formats": [
    {"id": "image-1x1", "kind": ["image"], "use": "Single image ad, desktop and phones (LinkedIn's recommended square).",
     "width": 1200, "height": 1200,
     "safe": {"top": 60, "bottom": 60, "left": 60, "right": 60, "blocks": [], "source": "house"}},
    {"id": "image-4x5", "kind": ["image"], "use": "Single image ad, phones only (LinkedIn's recommended vertical shape).",
     "width": 1080, "height": 1350,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}},
    {"id": "video-1x1", "kind": ["video"], "use": "Video ad, desktop and phones.",
     "width": 1080, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}},
    {"id": "video-4x5", "kind": ["video"], "use": "Video ad, phones only (recommended vertical shape).",
     "width": 1080, "height": 1350,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}},
    {"id": "video-16x9", "kind": ["video"], "use": "Video ad, desktop and phones (LinkedIn's advice when targeting desktop too).",
     "width": 1920, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 96, "right": 96, "blocks": [], "source": "house"}},
    {"id": "carousel-1x1", "kind": ["image"], "use": "Each carousel card (2 to 10). Images only: LinkedIn has no video carousels.",
     "width": 1080, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}}
  ],
  "video": {"files": ["mp4"], "min_kb": 75, "max_mb": 500, "fps": 30, "target_s": 15, "min_s": 3, "max_s": 1800, "ratio_tolerance": 0.05},
  "image": {"files": ["jpg", "png"], "max_mb": 5, "carousel_card_max_mb": 10}
}
```
- LinkedIn prints no safe zone: its buttons and text sit outside the picture. The "house" margin keeps text off the edges.
- Allowed video sizes: 1:1 from 360 x 360 to 1920 x 1920; 4:5 from 360 x 450 to 1080 x 1350; 9:16 from 360 x 640 to 1080 x 1920 (phones only); 16:9 from 640 x 360 to 1920 x 1080. Aspect ratio tolerance 5%.
- LinkedIn's advice: for desktop and phones, use 16:9 (or 1:1) video; upright video only reaches phones.

## Copy limits
| Field | Recommended | Maximum |
|---|---|---|
| Introductory text | 150 | 600 (video), 3,000 (single image) |
| Headline | 70 | 200 |
| Ad name (internal) | 255 | 255 |

## Carousels
- 2 to 10 cards, 1080 x 1080 (1:1), JPG or PNG, up to 10 MB each. Images only.

## Video and sound
- MP4, 75 KB to 500 MB, 3 seconds to 30 minutes, 30 fps recommended, sound AAC or MPEG4 under 64 kHz.
- Captions: on screen always; an SRT caption file is optional.
- Thumbnail (optional): JPG or PNG up to 2 MB, same shape and size as the video.

## What Max's packs make here (the "pack" line in Formats is what the tools follow; keep the two the same)

### Pack list (approved by Tavin 2026-11-21, decision 47)
| Item | Formats |
|---|---|
| Each still ad | image-1x1, image-4x5 |
| Carousel | carousel-1x1 (5 cards) |
| Carousel video | video-1x1, video-4x5, video-16x9 (16:9 is a new layout to build) |

## Sources (checked 2026-11-21)
- Video sizes, ratios, tolerance, 3 s to 30 min, MP4, 500 MB, text lengths: LinkedIn Marketing Solutions "Video Ads specs" (business.linkedin.com/advertise/ads/sponsored-content/video-ads/specs), **official**, via search extract; LinkedIn Help 85306 (linkedin.com/help/linkedin/answer/85306), **official**, via search extract (the page blocks automatic reading). Older pages say 200 MB; the current specs page says 500 MB.
- Vertical only on phones, 16:9 advice: LinkedIn video specs, **quoted** by QuickFrame; LinkedIn Help single image ads (a426534) for images.
- Single image ratios and 4:5 recommended vertical (720 x 900), 1:1 1200 x 1200, 5 MB, intro text 150 / 3,000, headline 70 / 200: LinkedIn Help a426534 and a423644, and business.linkedin.com single-image specs, **official**, via search extract.
- Carousel 2 to 10 cards, 1080 x 1080, 10 MB, JPG/PNG: LinkedIn ads guide (business.linkedin.com/advertise/ads/ads-guide), **official**, read 2026-11-21. No video carousels: Brandwatch and Strike Social, **quoted**.

## Open checks
1. Confirm whether lead-gen (Lead Gen Form) ads need their own image.
2. Confirm the 500 MB video limit in Campaign Manager at first upload (older pages say 200 MB; our 15 s files are far smaller either way).

## Changes
- 2026-11-21: sheet created.

## For Max
- The pack list above was approved by Tavin on 2026-11-21 (decision 47). 16:9 needs a new layout in the tools.
