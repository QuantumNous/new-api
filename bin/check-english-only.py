#!/usr/bin/env python3
"""Check authored source and prose while retaining pinned compatibility fixtures."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NON_ENGLISH_SCRIPT = re.compile(r"[\u0370-\u052f\u0600-\u06ff\u0900-\u097f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
TEXT_SUFFIXES = {'.go', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.md', '.css', '.html', '.sh', '.sql', '.lua', '.service', '.svg', '.py'}
allow_path = ROOT / 'english-only-fixtures.json'
allowed = json.loads(allow_path.read_text()) if allow_path.exists() else []
allowed_keys = {(entry['path'], entry['sha256']) for entry in allowed}
paths = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard'], cwd=ROOT, text=True).splitlines()
errors = []
fixtures = 0
checked = 0
for name in sorted(set(paths)):
    path = ROOT / name
    if not path.is_file() or (path.suffix not in TEXT_SUFFIXES and name != '.env.example'):
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    checked += 1
    for line_number, line in enumerate(text.splitlines(), 1):
        if NON_ENGLISH_SCRIPT.search(line):
            digest = hashlib.sha256(line.strip().encode()).hexdigest()
            if (name, digest) in allowed_keys:
                fixtures += 1
            else:
                errors.append(f'{name}:{line_number}: non-English script outside a pinned compatibility fixture')
    if name.startswith('web/src/i18n/locales/') and path.name != 'en.json':
        errors.append(f'{name}: translated interface resources are not permitted')
    if name.startswith('i18n/locales/') and path.name != 'en.yaml':
        errors.append(f'{name}: translated backend resources are not permitted')
    if name.startswith('README.') and path.name not in {'README.md', 'README.en.md'}:
        errors.append(f'{name}: translated repository guide is not permitted')
    if name.startswith('web/src/') and 'test' not in name:
        for forbidden in ['i18next-browser-languagedetector', 'LanguageSwitcher', 'showLanguageSwitcher']:
            if forbidden in text:
                errors.append(f'{name}: obsolete language-selection reference: {forbidden}')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'English-only check passed: {checked} text files; {fixtures} pinned Unicode/protocol fixture lines; no unapproved authored-script findings.')
print('Manual review still checks English wording, external content, and text embedded in images.')
