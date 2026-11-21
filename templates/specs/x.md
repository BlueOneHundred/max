# X: spec sheet

Owner: **X Bot**. Checked: **2026-11-21** (Hanoi). Next check: first workday of December 2026.
X ads run from X Ads Manager and show in the timeline on desktop and phones.

## Formats
```json
{
  "platform": "x",
  "checked": "2026-11-21",
  "pack": {"ad": ["image-1x1", "image-4x5"], "adVideo": [], "carousel": ["carousel-1x1"], "carouselVideo": ["image-1x1", "wide-16x9", "vertical-9x16"]},
  "formats": [
    {"id": "image-1x1", "kind": ["image", "video"], "use": "Image or video ad, square (X's recommended video shape with 16:9).",
     "width": 1200, "height": 1200,
     "safe": {"top": 60, "bottom": 60, "left": 60, "right": 60, "blocks": [], "source": "house"}},
    {"id": "image-4x5", "kind": ["image", "video"], "use": "Image or video ad, upright.",
     "width": 1440, "height": 1800,
     "safe": {"top": 72, "bottom": 72, "left": 72, "right": 72, "blocks": [], "source": "house"}},
    {"id": "wide-16x9", "kind": ["image", "video"], "use": "Image or video ad, wide (X's recommended video shape with 1:1).",
     "width": 1920, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 96, "right": 96, "blocks": [], "source": "house"}},
    {"id": "vertical-9x16", "kind": ["video"], "use": "Vertical video ad (full screen).",
     "width": 1080, "height": 1920,
     "safe": {"top": 120, "bottom": 300, "left": 65, "right": 65, "blocks": [], "source": "house"}},
    {"id": "carousel-1x1", "kind": ["image", "video"], "use": "Each carousel slide (2 to 6). One shape for the whole carousel.",
     "width": 1080, "height": 1080,
     "safe": {"top": 54, "bottom": 54, "left": 54, "right": 54, "blocks": [], "source": "house"}}
  ],
  "video": {"files": ["mp4", "mov"], "max_mb": 1024, "recommended_max_mb": 30, "fps": 30, "max_fps": 60, "target_s": 15, "max_s": 140, "target_kbps": [5000, 10000]},
  "image": {"files": ["png", "jpg"], "max_mb": 5}
}
```
- X prints no safe zone for timeline ads. The vertical video margin above is a **house** guess (X shows its own buttons on full-screen vertical video): confirm it (open check 1).
- Aspect ratios X accepts for images and videos: 4:5 (1440 x 1800), 2:3 (1080 x 1620), 1:1 (1080 x 1080), 1.91:1 (2064 x 1080), 16:9 (1920 x 1080), 9:16 (1080 x 1920). X recommends 1200 x 1200 (1:1) and 1920 x 1080 (16:9) for video.
- Video length: **15 seconds or less recommended**, up to 2 minutes 20 seconds. Videos under 60 seconds loop.

## Copy limits
| Field | Limit |
|---|---|
| Post text | 280 characters (257 with a link; each link counts 23) |
| Video headline | 70 (may be cut on some devices) |
| Carousel website title | 70 |

## Carousels
- **2 to 6 slides** (images or videos), one shape for the whole carousel; mixed image and video slides keep the same shape.
- Our 5-card carousels fit. Square (1:1) slides.

## Video and sound
- MP4 or MOV, up to 1 GB (under 30 MB recommended), up to 60 fps, bitrate target 5 to 10 Mbps (vertical video maximum 25 Mbps). We make 30 fps, 15 s, well under 30 MB.
- Thumbnail: PNG or JPEG, up to 5 MB. Captions on screen always.

## What Max's packs make here (the "pack" line in Formats is what the tools follow; keep the two the same)

### Pack list (approved by Tavin 2026-11-21, decision 47)
| Item | Formats |
|---|---|
| Each still ad | image-1x1, image-4x5 |
| Carousel | carousel-1x1 (5 slides) |
| Carousel video | image-1x1, wide-16x9 (new layout to build), vertical-9x16 |

## Sources (checked 2026-11-21)
- All sizes, ratios, lengths, file limits, copy limits and carousel rules: X Business "Creative ad specs" (business.x.com/en/help/campaign-setup/creative-ad-specifications), **official**, read 2026-11-21. The help.x.com copy of the same page also lists these ratios.

## Open checks
1. Find X's own guidance (or test in X Ads Manager preview) for what covers a full-screen vertical video, and replace the house margin.
2. Image ads: X still recommends 800 x 418 and 800 x 800 for website cards; confirm which image size X shows best for a plain image ad (we use 1200 x 1200 and 1440 x 1800).

## Changes
- 2026-11-21: sheet created.

## For Max
- The pack list above was approved by Tavin on 2026-11-21 (decision 47). 16:9 needs a new layout in the tools.
