---
name: i18n-translate
description: >-
  Complete and maintain frontend i18n translations for this project. Covers
  finding missing translation keys, detecting untranslated entries, and adding
  translations for all supported locales (en, zh, fr, ja, ru, vi). Use for any
  task involving frontend locale files, missing translation keys, untranslated
  UI text, `t(...)` keys, `useTranslation()`, static i18n keys, button/label/
  toast/dialog/placeholder/validation copy, or adding/fixing even a single
  i18n key. Use when review findings mention missing i18n, when new UI text
  needs translation, or when the user asks to add translations, fix i18n, or
  complete missing translations. Always load and follow this skill before
  translating, adding locale keys, or editing frontend i18n files.
---

# Frontend i18n Translation Workflow

## Mandatory Preflight

- Read this entire `SKILL.md` before any frontend i18n work, including one-key fixes.
- Before editing locale files, confirm the source text comes from a `t(...)` key, `en.json`, existing UI copy, or an explicitly requested new UI string.
- Use the user conversation only to understand the task target. Do not copy conversation text, review wording, or task descriptions directly into locale values.
- Before translating each key, re-think the intended UI copy from the code and locale context instead of treating the surrounding chat as the translation source.

### Hard Constraint: Locale Writes Go Through the Script

- You MUST NOT edit `web/default/src/i18n/locales/*.json` directly with text-editing tools (StrReplace, Write, search-and-replace, manual JSON edits, etc.). This applies even to a single key.
- ALL locale writes MUST go through the `add-missing-keys.mjs` script, followed by `bun run i18n:sync`. The script is the only sanctioned way to add or change locale values.
- Why this is mandatory, not optional:
  - Hand-editing reliably drops one or more of the six locales (`en`, `zh`, `fr`, `ja`, `ru`, `vi`), leaving keys missing in some languages.
  - Hand-editing breaks the required alphabetical key order and introduces JSON syntax errors (trailing commas, mismatched quotes).
  - The script writes all six files atomically with consistent sorting, so the locale set stays in sync by construction.
- The script does not do the translation for you. You still must reason out each locale's copy and populate the script's `newKeys` object; the script only handles insertion, sorting, and writing. Do not skip the script just because the thinking happens regardless.

## Scope Checklist

Before editing files, treat the task as covered by this skill if it involves:

- `i18n`, translation, locale files, language packs, missing keys, or untranslated text
- `t('...')`, `useTranslation()`, `static-keys.ts`, or `locales/*.json`
- UI copy in buttons, labels, toasts, dialogs, placeholders, validation messages, descriptions, or table/empty states
- A review finding about missing i18n keys

Do not skip this workflow because the fix is "just one key".

## Overview

- Locale files: `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json`
- Format: flat JSON under `"translation"` key, keys are English source strings
- Base locale: `en.json` (most keys), fallback: `zh` (Chinese)
- Sync script: `bun run i18n:sync` (from `web/default/`)
- All `t()` calls must have corresponding keys in every locale file

## Small Fix Path

For a single known missing key (still script-only, no direct JSON edits):

1. Confirm the exact key at the call site and verify it is absent from all locale files.
2. Add the key via `add-missing-keys.mjs`, populating its `newKeys` object for every supported locale: `en`, `zh`, `fr`, `ja`, `ru`, `vi`. Even one key goes through the script; do not hand-edit the JSON.
3. The script preserves the flat `"translation"` object and keeps keys alphabetically sorted automatically.
4. Run a targeted search for the key in code and locale files.
5. Run `bun run i18n:sync` to normalize file order. This step is mandatory, not optional.

## Workflow

### Step 1: Run sync and read report

```bash
cd web/default && bun run i18n:sync
```

Read `web/default/src/i18n/locales/_reports/_sync-report.json` to see per-locale status (missingCount, extrasCount, untranslatedCount).

### Step 2: Find missing keys (used in code but not in locale files)

Create and run `web/default/scripts/find-missing-keys.mjs`:

```javascript
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')
const SRC_DIR = path.resolve('src')

const en = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, 'en.json'), 'utf8'))
const enKeys = new Set(Object.keys(en.translation))

const tCallRegex = /\bt\(\s*['"`]([^'"`\n]+?)['"`]\s*[,)]/g
const tCallMultilineRegex = /\bt\(\s*['"`]([^'"`]+?)['"`]\s*\)/g

async function walkDir(dir) {
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'locales', '_reports', '_extras'].includes(entry.name)) continue
      files.push(...(await walkDir(fullPath)))
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

const files = await walkDir(SRC_DIR)
const missingKeys = new Map()

for (const file of files) {
  const content = await fs.readFile(file, 'utf8')
  const relPath = path.relative(SRC_DIR, file)
  for (const regex of [tCallRegex, tCallMultilineRegex]) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(content)) !== null) {
      const key = match[1]
      if (key.startsWith('{{') || key.includes('${')) continue
      if (!enKeys.has(key)) {
        if (!missingKeys.has(key)) missingKeys.set(key, [])
        missingKeys.get(key).push(relPath)
      }
    }
  }
}

if (missingKeys.size === 0) {
  console.log('All t() keys found in en.json!')
} else {
  console.log(`Found ${missingKeys.size} missing keys:\n`)
  for (const [key, files] of [...missingKeys.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  "${key}"`)
    for (const f of [...new Set(files)]) console.log(`    -> ${f}`)
  }
}
```

### Step 3: Find untranslated entries (value equals English)

Create and run `web/default/scripts/find-untranslated.mjs`:

```javascript
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')
const en = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, 'en.json'), 'utf8'))
const enTrans = en.translation

// Brand names, URLs, technical terms — skip these
const skipPatterns = [
  /^https?:\/\//, /^smtp\./, /^socks5:/, /^name@/, /^noreply@/,
  /^org-/, /^price_/, /^whsec_/, /^edit_this$/, /^my-status$/,
  /^_copy$/, /^gpt-/, /^checkout\./, /^footer\./, /^\[?\{/,
  /^"default/, /^\/status\//, /^\/your\//, /^example\.com/,
  /^AZURE_/, /^AccessKey/, /^OAuth/, /^Client /, /^Webhook URL/,
  /^API URL$/, /^Well-Known/, /^Worker URL$/, /^Uptime Kuma/,
  /^New API/, /^Baidu V2$/, /^Zhipu V4$/, /^Quota:$/,
]

const brandNames = new Set([
  'AIGC2D','Anthropic','API2GPT','Claude','Cloudflare','Cohere','DeepSeek',
  'Discord','DoubaoVideo','FastGPT','Gemini','GitHub','Jimeng','JustSong',
  'LingYiWanWu','LinuxDO','Midjourney','MidjourneyPlus','MiniMax','Mistral',
  'MokaAI','Moonshot','NewAPI','OhMyGPT','Ollama','OpenAI','OpenAIMax',
  'OpenRouter','Passkey','Perplexity','QuantumNous','Replicate','SiliconFlow',
  'Stripe','Submodel','SunoAPI','Telegram','Tencent','Vertex AI','VolcEngine',
  'WeChat','Xinference','Xunfei','AI Proxy','One API',
])

const locales = ['fr', 'ja', 'ru', 'zh', 'vi']

for (const locale of locales) {
  const locFile = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, `${locale}.json`), 'utf8'))
  const locTrans = locFile.translation
  const untranslated = {}

  for (const [key, enVal] of Object.entries(enTrans)) {
    const locVal = locTrans[key]
    if (locVal === undefined || locVal !== enVal) continue
    if (brandNames.has(key)) continue
    if (skipPatterns.some(p => p.test(key))) continue
    if (typeof enVal === 'string' && enVal.length < 4) continue
    if (/[a-zA-Z]{3,}/.test(String(enVal))) untranslated[key] = enVal
  }

  const count = Object.keys(untranslated).length
  if (count > 0) {
    console.log(`\n=== ${locale} (${count} untranslated) ===`)
    for (const [k, v] of Object.entries(untranslated))
      console.log(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  } else {
    console.log(`\n=== ${locale}: all translated ===`)
  }
}
```

### Step 4: Add translations

This script is the ONLY sanctioned way to write locale values. You MUST NOT bypass it by hand-filling the JSON files. Create `web/default/scripts/add-missing-keys.mjs` with this exact structure:

```javascript
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: { /* "key": "English value" */ },
  zh: { /* "key": "中文翻译" */ },
  fr: { /* "key": "Traduction française" */ },
  ja: { /* "key": "日本語翻訳" */ },
  ru: { /* "key": "Русский перевод" */ },
  vi: { /* "key": "Bản dịch tiếng Việt" */ },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => { console.error(err); process.exitCode = 1 })
```

Populate the `newKeys` object with actual translations for each locale.

### Step 5: Verify and clean up

```bash
cd web/default
node scripts/add-missing-keys.mjs   # apply translations
node scripts/find-missing-keys.mjs  # verify: should say "All t() keys found"
bun run i18n:sync                   # normalize file order
```

Delete temporary scripts after completion.

## Translation Guidelines

### Source Text Rules

- Reconsider every key's UI meaning before translating: component location, user action, placeholder variables, button/label/toast/dialog/validation context, and whether the copy is a noun, command, status, or full sentence.
- Prefer the English key or `en` value as the source text. Use the call site only to clarify meaning, tone, and constraints.
- Do not copy chat messages, review comments, issue descriptions, or task wording as translation text.
- If the source text is unclear, inspect the code and locale files first. Ask the user for exact source copy only when the intended UI text remains ambiguous.

### Length and Layout Awareness

- Consider whether translated text may overflow the UI before choosing final wording, especially for buttons, table headers, menu items, labels, toasts, dialog titles, tabs, badges, and empty states.
- For languages that often expand relative to English, especially French, Russian, and Vietnamese, prefer natural but compact wording.
- Do not sacrifice meaning just to shorten text. When the call site has limited space, choose the shortest clear translation that preserves the UI intent.
- For interpolated variables, counts, model names, provider names, quotas, and dates, consider the longest realistic rendered text, not only the translation string itself.

| Language | Code | Notes |
|----------|------|-------|
| English | en | Base locale, key = value |
| Chinese | zh | Fallback locale, must be complete |
| French | fr | Many English cognates are valid (e.g., "Configuration") |
| Japanese | ja | Use katakana for technical loanwords |
| Russian | ru | Use formal register |
| Vietnamese | vi | Use standard Vietnamese |

**Keep as English (do not translate):**
- Brand/product names (OpenAI, Claude, Gemini, etc.)
- URLs and email placeholders
- Technical identifiers (JSON keys, API paths, model names)
- Code-like strings (gpt-3.5-turbo, price_xxx, etc.)

**Always translate:**
- UI labels, button text, error messages, descriptions
- Time units (hours, minutes, months, years)
- Action words (Move, Show, Delete, etc.)

## Key Rules

1. All scripts run from `web/default/` directory
2. Use `node scripts/xxx.mjs` (ESM format with top-level await)
3. Sort keys alphabetically when writing locale files
4. Always run `bun run i18n:sync` as the final step
5. Delete temporary scripts after completion
6. The `{{variable}}` placeholders in keys must be preserved in all translations
7. NEVER edit `locales/*.json` directly. Any non-script write to a locale file (StrReplace, Write, manual JSON edit) is non-compliant, including single-key fixes.
