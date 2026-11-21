#!/usr/bin/env python3
"""Make the 5 platform bot prompts from platform-bot.template.md (edit the template, never the 5 files by hand).
Usage: python3 make_platform_bots.py && python3 build.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
T = open(os.path.join(HERE, 'platform-bot.template.md'), encoding='utf-8').read()
META_SRC = "Meta's own Ads Guide often refuses automatic reading: then use the quoted sources listed and say so in \"## For Max\", and suggest Tavin checks Ads Manager's Safe zone guardrail at the next real upload."
B = {
 'facebook': dict(NAME='Facebook Bot', PLATFORM='Facebook', SRC=META_SRC,
  CAROUSEL="make_pack_carousel with the carousel's name, swipe (if given) and all its cards (square cards), then make_pack_video with the same cards (it leaves the title card out and makes the 4:5, 1:1 and 9:16 videos).",
  NOTES="- Shapes (from the sheet): feed 4:5 for phones, feed 1:1 because Facebook on a computer shows 1:1, and 9:16 for Reels and Stories. Carousel cards are square.\n- Reels and Stories cover the top 14%, the bottom 35% and 6% each side; the tools keep words out of them.\n- Copy lengths are Ad Writer's job, but tell Ad Writer if copy.md breaks the sheet's limits (feed headline 27, Reels primary text about 40)."),
 'instagram': dict(NAME='Instagram Bot', PLATFORM='Instagram', SRC=META_SRC,
  CAROUSEL="make_pack_carousel with the carousel's name, swipe (if given) and all its cards (square cards), then make_pack_video with the same cards (4:5 and 9:16 videos).",
  NOTES="- Shapes: feed 4:5 (Instagram's recommended feed shape) and 9:16 for Reels and Stories. No 1:1 for Instagram. Carousel cards are square.\n- Reels ads must never use licensed music; our videos have no sound."),
 'tiktok': dict(NAME='TikTok Bot', PLATFORM='TikTok',
  SRC="TikTok publishes its safe zone as a downloadable template on the In-Feed page; if you cannot open it, keep the numbers and say so.",
  CAROUSEL="TikTok has no still carousel in our packs (TikTok carousels need music). Call only make_pack_video with all cards of ads.json's carousel (9:16).",
  NOTES="- Everything is 9:16 video. make_pack_ad turns each still ad into an 8-second video with a slow zoom (the sheet's \"adVideo\").\n- TikTok's buttons (like, comment, share) cover a column on the right from about half way down; the tools keep words left of it and put the business name under the words, on the left.\n- No music: any sound in a TikTok ad must be licensed or from TikTok's Commercial Music Library, and we use none."),
 'linkedin': dict(NAME='LinkedIn Bot', PLATFORM='LinkedIn',
  SRC="LinkedIn Help pages may refuse automatic reading; then use the business.linkedin.com spec pages listed.",
  CAROUSEL="make_pack_carousel with the carousel's name, swipe (if given) and all its cards (square images only: LinkedIn has no video carousels), then make_pack_video with the same cards (1:1, 4:5 and 16:9 videos).",
  NOTES="- Shapes: still ads 1:1 (desktop and phones) and 4:5 (phones only). Videos 1:1, 4:5 and 16:9 (16:9 is LinkedIn's advice for desktop too).\n- On 16:9 the words sit on the left over a fade and the business name sits under them, on the left."),
 'x': dict(NAME='X Bot', PLATFORM='X',
  SRC='The X Business "Creative ad specs" page is the main source.',
  CAROUSEL="make_pack_carousel with the carousel's name, swipe (if given) and all its cards (square slides; X allows 2 to 6, so if the carousel has more than 6 cards, ask Ad Writer for a 6-card version under \"## Word changes needed (X Bot)\" and stop), then make_pack_video with the same cards (1:1, 16:9 and 9:16 videos).",
  NOTES="- Shapes: still ads 1:1 and 4:5; videos 1:1, 16:9 and vertical 9:16.\n- The vertical safe zone in the sheet is a house guess (open check 1): look extra carefully at the bottom of every 9:16 frame, and if you can confirm X's real numbers in a SPEC CHECK, update them."),
}
for slug, b in B.items():
    s = T
    for k, v in {'NAME': b['NAME'], 'PLATFORM': b['PLATFORM'], 'SLUG': slug, 'CAROUSEL_STEP': b['CAROUSEL'], 'SOURCE_NOTE': b['SRC'], 'NOTES': b['NOTES']}.items():
        s = s.replace('{{' + k + '}}', v)
    assert '{{' not in s.replace('{{SHARED}}', ''), slug
    open(os.path.join(HERE, f'{slug}-bot.md'), 'w', encoding='utf-8').write(s)
    print('made', slug + '-bot.md')
