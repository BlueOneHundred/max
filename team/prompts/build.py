#!/usr/bin/env python3
"""Assemble each Max bot's full instructions: its prompt file with {{SHARED}} replaced by _shared.md.
Usage: python3 build.py   (writes built/<bot>.txt). Platform bot prompts come from platform-bot.template.md:
edit the template and re-run make_platform_bots() below, never the five files by hand."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SHARED = open(os.path.join(HERE, '_shared.md'), encoding='utf-8').read().strip()
BOTS = ['facebook-bot', 'instagram-bot', 'tiktok-bot', 'linkedin-bot', 'x-bot', 'rule-checker', 'visual-check']
os.makedirs(os.path.join(HERE, 'built'), exist_ok=True)
for b in BOTS:
    text = open(os.path.join(HERE, b + '.md'), encoding='utf-8').read()
    assert text.count('{{SHARED}}') == 1, b
    out = text.replace('{{SHARED}}', SHARED).strip() + '\n'
    assert '{{' not in out and '—' not in out and '–' not in out, b
    open(os.path.join(HERE, 'built', b + '.txt'), 'w', encoding='utf-8').write(out)
    print(b, len(out), 'characters')
