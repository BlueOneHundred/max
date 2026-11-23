#!/usr/bin/env python3
"""Add (or update) Max's team bots in the Max app's settings file. Run ONLY with the Max app fully closed.
Usage: python3 apply_to_max.py <Max data folder> [--dry]
Reads built/<bot>.txt next to this script (run build.py first). Keeps every other bot, chat and setting as it is,
backs up workspace.json first, and checks the result is valid before saving. Same method as Toby's apply.py."""
import json, os, re, shutil, sys, time, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
LIMIT = 32000  # the app's limit for bot instructions (Toby build 31 onwards; Max is built on Toby build 45)
NO_WEB = {'web': False, 'files': True, 'computer': False, 'connections': False}
WEB = {'web': True, 'files': True, 'computer': False, 'connections': False}
TEAM = [
    {'name': 'Facebook Bot', 'file': 'facebook-bot.txt', 'shape': 'hex', 'color': 'cyan', 'hex': '#2F5DA8', 'caps': WEB},
    {'name': 'Instagram Bot', 'file': 'instagram-bot.txt', 'shape': 'flower', 'color': 'magenta', 'hex': '#9A3F7A', 'caps': WEB},
    {'name': 'TikTok Bot', 'file': 'tiktok-bot.txt', 'shape': 'sparkle', 'color': 'cyan', 'hex': '#2A4B55', 'caps': WEB},
    {'name': 'LinkedIn Bot', 'file': 'linkedin-bot.txt', 'shape': 'hex', 'color': 'cyan', 'hex': '#25618A', 'caps': WEB},
    {'name': 'X Bot', 'file': 'x-bot.txt', 'shape': 'star6', 'color': 'yellow', 'hex': '#4A4A4A', 'caps': WEB},
    {'name': 'Rule Checker', 'file': 'rule-checker.txt', 'shape': 'heartChubby', 'color': 'green', 'hex': '#3E6E4F', 'caps': NO_WEB},
    {'name': 'Visual Check', 'file': 'visual-check.txt', 'shape': 'hex', 'color': 'orange', 'hex': '#35444F', 'caps': NO_WEB},
    # Session 5 (23 Nov 2026): the other 6. Max already exists in the app (its starting bot): only its instructions, capabilities and model change.
    {'name': 'Max', 'file': 'max.txt', 'shape': 'star6', 'color': 'green', 'hex': '#1F6B3A', 'caps': NO_WEB},
    {'name': 'Lead Finder', 'file': 'lead-finder.txt', 'shape': 'sparkle', 'color': 'yellow', 'hex': '#7A6A2A', 'caps': WEB},
    {'name': 'Fact Finder', 'file': 'fact-finder.txt', 'shape': 'flower', 'color': 'green', 'hex': '#4A6B3E', 'caps': WEB},
    {'name': 'Ad Writer', 'file': 'ad-writer.txt', 'shape': 'heartChubby', 'color': 'magenta', 'hex': '#7A3F5E', 'caps': NO_WEB},
    {'name': 'Page Builder', 'file': 'page-builder.txt', 'shape': 'hex', 'color': 'cyan', 'hex': '#2F6E7A', 'caps': NO_WEB},
    {'name': 'Outreach Writer', 'file': 'outreach-writer.txt', 'shape': 'star6', 'color': 'orange', 'hex': '#8A5A2E', 'caps': NO_WEB},
]
MODEL = 'opus'  # careful checking and judging by eye: the strongest model, as Toby's writers use

def check(text, name):
    if len(text) > LIMIT: raise SystemExit(f'{name}: instructions too long ({len(text)})')
    if '—' in text or '–' in text: raise SystemExit(f'{name}: has an em or en dash')
    if '{{' in text: raise SystemExit(f'{name}: placeholder left')

def build(state):
    names = {b['name']: b for b in state['bots']}
    now = int(time.time() * 1000)
    added, updated = [], []
    for spec in TEAM:
        text = open(os.path.join(HERE, 'built', spec['file']), encoding='utf-8').read().strip()
        check(text, spec['name'])
        if spec['name'] in names:
            b = names[spec['name']]; b['instructions'] = text; b['capabilities'] = spec['caps']; b['model'] = MODEL
            # Session 5: the app's starter bot (Max) was on 'auto' and rewrote its own instructions from the first message. Ours are hand-written.
            b['promptMode'] = 'manual'; b['promptGenerated'] = True; updated.append(spec['name']); continue
        bid, cid = str(uuid.uuid4()), str(uuid.uuid4())
        state['bots'].append({'id': bid, 'name': spec['name'], 'avatarSeed': spec['name'], 'avatarDefaultShape': spec['shape'], 'avatarDefaultColor': spec['color'],
            'userPromptTemplate': '{{message}}', 'promptMode': 'manual', 'promptGenerated': True, 'avatarShape': spec['shape'], 'avatarColor': spec['color'],
            'color': spec['hex'], 'avatarDataUrl': None, 'createdAt': now, 'capabilities': spec['caps'], 'codexModel': '', 'model': MODEL,
            'memoryProfileAccess': True, 'memory': '', 'instructions': text})
        state['conversations'].append({'id': cid, 'botId': bid, 'title': 'New conversation', 'draft': '', 'messages': [], 'createdAt': now, 'updatedAt': now,
            'claudeSession': None, 'codexSession': None})
        added.append(spec['name'])
    return state, added, updated

if __name__ == '__main__':
    data = sys.argv[1]; dry = '--dry' in sys.argv
    ws = os.path.join(data, 'workspace.json')
    state = json.load(open(ws, encoding='utf-8'))
    state, added, updated = build(state)
    text = re.sub('[\ud800-\udfff]', lambda m: '\\u%04x' % ord(m.group()), json.dumps(state, ensure_ascii=False))
    json.loads(text)
    if dry:
        print('DRY RUN, nothing saved.')
    else:
        backup = os.path.join(data, time.strftime('workspace.before-max-team-%Y%m%d-%H%M%S.json'))
        shutil.copy2(ws, backup)
        tmp = ws + '.new'
        open(tmp, 'w', encoding='utf-8').write(text)
        json.load(open(tmp, encoding='utf-8'))
        os.replace(tmp, ws)
        print('saved; backup:', os.path.basename(backup))
    print('added:', ', '.join(added) or 'none'); print('updated:', ', '.join(updated) or 'none')
    for b in state['bots']: print(f"  {b['name']:14} {len(b.get('instructions') or ''):6} chars  model={b.get('model') or 'default'}  caps={b.get('capabilities')}")
