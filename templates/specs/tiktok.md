# TikTok: spec sheet

Owner: **TikTok Bot**. Checked: **2026-11-21** (Hanoi). Next check: first workday of December 2026.
TikTok ads run from TikTok Ads Manager. Everything is built for the full-screen phone feed (In-Feed ads).

## Formats
```json
{
  "platform": "tiktok",
  "checked": "2026-11-21",
  "pack": {"ad": [], "adVideo": ["infeed-9x16"], "carousel": [], "carouselVideo": ["infeed-9x16"]},
  "formats": [
    {"id": "infeed-9x16", "kind": ["video"], "use": "In-Feed video ads (TikTok's recommended shape).",
     "width": 1080, "height": 1920,
     "safe": {"top": 240, "bottom": 660, "left": 120, "right": 120,
              "blocks": [[780, 840, 300, 1080]], "source": "platform"}},
    {"id": "carousel-9x16", "kind": ["image"], "use": "Carousel ad images (2 to 35). Needs a music track.",
     "width": 1080, "height": 1920,
     "safe": {"top": 240, "bottom": 660, "left": 120, "right": 120,
              "blocks": [[780, 840, 300, 1080]], "source": "platform"}}
  ],
  "video": {"files": ["mp4", "mov"], "max_mb": 500, "fps": 30, "target_s": 15, "min_s": 5, "max_s": 600, "min_kbps": 516},
  "image": {"files": ["jpg", "png"], "suggested_max_kb": 100}
}
```
- Safe zone on 1080 x 1920: keep clear the **top 240 px**, the **bottom 660 px**, **120 px on each side**, and TikTok's **button column** (like, comment, share, profile): **300 px wide on the right, from 840 px down** (block `[780, 840, 300, 1080]`). Our Meta 9:16 layout does **not** fit this: TikTok needs its own layout.
- TikTok also shows the account name and caption over the bottom of the video; long captions cover more.
- Lengths: TikTok's In-Feed page allows up to 10 minutes; TikTok recommends **9 to 15 seconds**. Ours are **15 seconds**.

## Copy and account
- Ad caption: no limit printed on the In-Feed page; it shows in white in TikTok's font; no clickable links, @ or hashtags in ad captions.
- Display name: up to 20 characters (one line).
- Profile image: 98 x 98 px, JPG or PNG, under 50 KB, key part inside the centre 66 x 66 px.

## Carousels
- 2 to 35 images, JPG or PNG; TikTok suggests 100 KB or less per image; 9:16 recommended (720 x 1280 minimum on the carousel page; we make 1080 x 1920).
- **Music is required** (MP3, at least 2 seconds, up to 10 MB, loops). One caption, one call to action and one link for all images.
- Because a carousel needs music (and music must be licensed for ads, rule M3), we give TikTok the **carousel as a video** instead, which needs no music.

## Video and sound
- MP4 or MOV (also MPEG, 3GP, AVI), up to 500 MB, bitrate at least 516 kbps, 9:16 at least 540 x 960 (we make 1080 x 1920, 30 fps).
- Captions on screen always. TikTok is a sound-on app; any music must be licensed or from TikTok's Commercial Music Library (rule M3).

## What Max's packs make here (the "pack" line in Formats is what the tools follow; keep the two the same)

### Pack list (approved by Tavin 2026-11-21, decision 47)
| Item | Formats |
|---|---|
| Carousel video | infeed-9x16, 15 s |
| Each still ad | infeed-9x16 as a short video (the still with a slow zoom, about 6 to 10 s), since TikTok runs videos and music-backed carousels, not single stills |

## Sources (checked 2026-11-21)
- In-Feed sizes, file types, 10-minute maximum, 500 MB, 516 kbps, caption, display name, profile image: TikTok Ads help "TikTok Auction In-Feed Ads" (ads.tiktok.com/help/article/video-ads-specifications), **official**, page updated June 2026.
- 9 to 15 seconds recommended, 5 to 60 seconds: TikTok Ads help (TopView and in-feed spec pages), **official**, via search extract; quoted by relevantaudience.com and stackmatix.com.
- Carousel: TikTok Ads help "Specifications for Carousel Ads" (ads.tiktok.com/help/article/specifications-for-carousel-ads), **official**, updated September 2026.
- Safe zone pixels: TikTok publishes them only as downloadable template files ("In-Feed Standard Version LTR") on the In-Feed page. Pixel figures **quoted** from upload-post.com (measured from that template, 720 x 1280 scaled x1.5: top 160, bottom 440, sides 80, button column 200 wide from 560 down) and blog.adnabu.com (same 720 x 1280 figures).

## Open checks
1. Download TikTok's own safe zone template (In-Feed Standard LTR) and confirm the pixels above.
2. Confirm TikTok accepts single still images as In-Feed ads without music (if yes, add a still format).

## Changes
- 2026-11-21: sheet created.

## For Max
- The pack list above was approved by Tavin on 2026-11-21 (decision 47).
- Open check 1 needs a browser download (Claude in Chrome).
