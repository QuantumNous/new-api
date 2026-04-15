---
name: i18n-translate
description: >-
  Complete and maintain frontend i18n translations for this project. Covers
  finding missing translation keys, detecting untranslated entries, and adding
  translations for all supported locales (en, zh, fr, ja, ru, vi). Use when the
  user asks to add translations, fix i18n, complete missing translations, or
  when new UI text needs to be internationalized.
---

# Frontend i18n Translation Workflow

## Overview

- Locale files: `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json`
- Format: flat JSON under `"translation"` key, keys are English source strings
- Base locale: `en.json` (most keys), fallback: `zh` (Chinese)
- Sync script: `bun run i18n:sync` (from `web/default/`)
- All `t()` calls must have corresponding keys in every locale file

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

Create `web/default/scripts/add-missing-keys.mjs` with this structure:

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
