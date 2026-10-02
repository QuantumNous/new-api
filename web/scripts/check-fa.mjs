/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// Checks the Persian locale against the typography rules in docs/i18n/fa.md.
//
// Usage (from web/): node scripts/check-fa.mjs [fa.json] [--en en.json]
//   [--src dir]
// Without a fa.json argument, the source directory defaults to src/ and is
// scanned for left-to-right inputs whose placeholder is a Persian translation.
// Exits with code 1 when any finding is reported.
import fs from 'node:fs/promises'
import path from 'node:path'

import { parse } from '@babel/parser'

const ZWNJ = '‌'
// Persian letters only (no digits, punctuation or diacritics). Includes the
// Arabic yeh/kaf so words containing them are still tokenized as words.
const LETTER =
  '\\u0621-\\u063A\\u0641-\\u064A\\u067E\\u0686\\u0698\\u06A9\\u06AF\\u06C0\\u06CC'
const P = `[${LETTER}]`
const WORD_SPLIT = new RegExp(`[^${LETTER}]+`)
// A Latin word or number, or the edge of an i18next placeholder.
const LATIN_START = '[A-Za-z0-9{]'
const LATIN_END = '[A-Za-z0-9}]'

// Words that begin with می / نمی but are not verbs with the continuous prefix.
const MI_WORDS = new Set([
  'میان',
  'میانه',
  'میانی',
  'میانجی',
  'میانبر',
  'میز',
  'میزان',
  'میزبان',
  'میزبانی',
  'میدان',
  'میل',
  'میله',
  'میلیون',
  'میلیارد',
  'میهمان',
  'میراث',
  'میوه',
])
const MI_WORD_PREFIXES = ['میانگین', 'میلی', 'میکرو', 'مینی']
// Words that end in ها / های / هایی without being a plural.
const HA_WORDS = new Set([
  'تنها',
  'تنهایی',
  'رها',
  'رهایی',
  'بها',
  'بهای',
  'نهایی',
  'انتها',
  'انتهای',
  'اژدها',
])
const HA_SUFFIXES = ['هایی', 'های', 'ها']
// Letters that never join to the next letter. After them, the plural ها is
// written directly (کلیدها), because a ZWNJ there has no visible effect.
const NON_JOINING = 'اآأإدذرزژوؤ'
// Comparatives written joined, as the Academy of Persian Language allows.
const JOINED_COMPARATIVE_STEMS = 'بیش|کم|به'
// Common adjectives whose comparative/superlative is written joined by mistake.
const COMPARATIVE_JOINED = new RegExp(
  '^(سریع|بزرگ|کوچک|جدید|تازه|قدیمی|مهم|ساده|دقیق|امن|قوی|ارزان|گران|آسان|سخت|طولانی|کوتاه|پایین|بالا|زیاد|دور|نزدیک|سبک|سنگین)(ترین|تری|تر)$'
)

const TEXT_RULES = [
  {
    id: 'arabic-yeh-kaf',
    pattern: /[يك]/,
    message: 'Arabic ي or ك; use Persian ی (U+06CC) and ک (U+06A9)',
  },
  {
    id: 'arabic-indic-digit',
    pattern: /[٠-٩]/,
    message: 'Arabic-Indic digit (٠ to ٩)',
  },
  {
    id: 'heh-hamza',
    pattern: /هٔ/,
    message: 'ه followed by U+0654; use the single character ۀ (U+06C0)',
  },
  { id: 'em-dash', pattern: /—/, message: 'em dash in Persian text' },
  {
    id: 'double-space',
    pattern: / {2,}/,
    message: 'more than one space in a row',
  },
  {
    id: 'irregular-space',
    pattern: /[\t  -​ ﻿]/,
    message: 'tab, no-break or other irregular space',
  },
  {
    id: 'misplaced-zwnj',
    pattern: new RegExp(`(?<!${P})${ZWNJ}|${ZWNJ}(?!${P})`),
    message: 'ZWNJ must sit between two Persian letters',
  },
  {
    id: 'latin-punctuation',
    pattern: /[,;?"]/,
    persianOnly: true,
    message: 'Latin , ; ? or " in Persian text; use ، ؛ ؟ « »',
  },
  {
    id: 'space-before-mark',
    pattern: /\s[،؛؟!.:»…]|«\s/,
    message: 'space before a punctuation mark (or after «)',
  },
  {
    id: 'latin-spacing',
    pattern: new RegExp(`${P}${LATIN_START}|${LATIN_END}${P}`),
    message:
      'Latin word or number touching Persian text; separate with one space',
  },
  {
    id: 'mi-prefix-space',
    pattern: new RegExp(`(?<![${LETTER}${ZWNJ}])ن?می (?=${P})`),
    message: 'space after the می/نمی verb prefix; use ZWNJ',
  },
  {
    id: 'plural-space',
    pattern: new RegExp(`${P}\\s+(ها|های|هایی)(?![${LETTER}${ZWNJ}])`),
    message:
      'space before the plural ها; use ZWNJ, or nothing after a non-joining letter',
  },
  {
    id: 'plural-zwnj-after-non-joining',
    pattern: new RegExp(
      `[${NON_JOINING}]${ZWNJ}(ها|های|هایی)(?![${LETTER}${ZWNJ}])`
    ),
    message:
      'ZWNJ before ها after a non-joining letter; write it joined: کلیدها',
  },
  {
    id: 'comparative-space',
    pattern: new RegExp(`${P}\\s+(تر|ترین)(?![${LETTER}${ZWNJ}])`),
    message: 'space before تر/ترین; use ZWNJ (بیشتر، کمتر، بهتر are joined)',
  },
  {
    id: 'comparative-exception-zwnj',
    pattern: new RegExp(
      `(?<![${LETTER}${ZWNJ}])(${JOINED_COMPARATIVE_STEMS})${ZWNJ}(تر|ترین)(?![${LETTER}${ZWNJ}])`
    ),
    message: 'write بیشتر، کمتر، بهتر and their superlatives joined',
  },
]

function isJoinedMiVerb(word) {
  const prefix = word.startsWith('نمی') ? 'نمی' : 'می'
  if (!word.startsWith(prefix) || word.length <= prefix.length + 1) return false
  if (MI_WORDS.has(word)) return false
  return !MI_WORD_PREFIXES.some((allowed) => word.startsWith(allowed))
}

function isJoinedPlural(word) {
  if (HA_WORDS.has(word)) return false
  return HA_SUFFIXES.some(
    (suffix) =>
      word.endsWith(suffix) &&
      word.length >= suffix.length + 2 &&
      !NON_JOINING.includes(word.at(-suffix.length - 1))
  )
}

const WORD_RULES = [
  {
    id: 'mi-prefix-joined',
    test: isJoinedMiVerb,
    message: 'می/نمی verb prefix joined to the verb; use ZWNJ',
  },
  {
    id: 'plural-joined',
    test: isJoinedPlural,
    message: 'plural ها joined to the word; use ZWNJ',
  },
  {
    id: 'comparative-joined',
    test: (word) => COMPARATIVE_JOINED.test(word),
    message: 'تر/ترین joined to the word; use ZWNJ',
  },
]

// Directional isolates: LRI, RLI and FSI open one, PDI closes the innermost.
const ISOLATE_OPENERS = '\u2066\u2067\u2068'
const RLI = '\u2067'
const PDI = '\u2069'

function hasUnbalancedIsolates(value) {
  let depth = 0
  for (const char of value) {
    if (ISOLATE_OPENERS.includes(char)) depth++
    if (char !== PDI) continue
    if (depth === 0) return true
    depth--
  }
  return depth !== 0
}

function markupTokens(value) {
  const placeholders = value.match(/\{\{[^}]*\}\}/g) ?? []
  const tags = value.match(/<\/?[A-Za-z][^>]*>/g) ?? []
  const nesting = value.match(/\$t\([^)]*\)/g) ?? []
  return [...placeholders, ...tags, ...nesting].sort()
}

/**
 * Returns every typography finding for a Persian translation map, checked
 * against the English map it translates.
 */
function checkPersianTranslations(faTranslation, enTranslation) {
  const findings = []
  const report = (key, rule, message) => findings.push({ key, rule, message })

  for (const [key, value] of Object.entries(faTranslation)) {
    if (!Object.hasOwn(enTranslation, key)) {
      report(key, 'unknown-key', 'key does not exist in en.json')
      continue
    }
    if (typeof value !== 'string' || value.trim() === '') {
      report(key, 'empty-value', 'value is empty or not a string')
      continue
    }
    if (value !== value.trim()) {
      report(key, 'edge-whitespace', 'leading or trailing whitespace')
    }

    const english = String(enTranslation[key])
    if (markupTokens(value).join('\n') !== markupTokens(english).join('\n')) {
      report(
        key,
        'markup-mismatch',
        'placeholders or markup differ from the English source'
      )
    }

    if (hasUnbalancedIsolates(value)) {
      report(
        key,
        'unbalanced-isolate',
        'FSI, LRI or RLI without a closing PDI, or a PDI without an opener'
      )
    }

    // Placeholders, tags and URLs are code, not Persian text. Replace them
    // with a Latin marker so spacing around them is still checked.
    const text = value
      .replaceAll(/\{\{[^}]*\}\}/g, '{x}')
      .replaceAll(/<[^>]*>/g, '\u0000')
      .replaceAll(/https?:\/\/\S+/g, 'x')

    const hasPersian = new RegExp(P).test(text)
    for (const rule of TEXT_RULES) {
      if (rule.persianOnly && !hasPersian) continue
      if (rule.pattern.test(text)) report(key, rule.id, rule.message)
    }
    const words = text.split(WORD_SPLIT).filter(Boolean)
    for (const rule of WORD_RULES) {
      const hits = words.filter(rule.test)
      if (hits.length > 0) {
        report(key, rule.id, `${rule.message}: ${hits.join(', ')}`)
      }
    }
  }
  return findings
}

function attributeValue(element, name) {
  const attribute = element.attributes.find(
    (item) => item.type === 'JSXAttribute' && item.name.name === name
  )
  if (!attribute?.value) return undefined
  if (attribute.value.type === 'StringLiteral') return attribute.value
  if (attribute.value.type === 'JSXExpressionContainer') {
    return attribute.value.expression
  }
  return undefined
}

function translationKeysIn(node, keys = []) {
  if (!node || typeof node.type !== 'string') return keys
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 't' &&
    node.arguments[0]?.type === 'StringLiteral'
  ) {
    keys.push(node.arguments[0].value)
  }
  for (const [field, child] of Object.entries(node)) {
    if (field === 'loc' || field === 'start' || field === 'end') continue
    const children = Array.isArray(child) ? child : [child]
    for (const item of children) {
      if (item && typeof item.type === 'string') translationKeysIn(item, keys)
    }
  }
  return keys
}

function forEachJsxElement(node, visit) {
  if (!node || typeof node.type !== 'string') return
  if (node.type === 'JSXOpeningElement') visit(node)
  for (const [field, child] of Object.entries(node)) {
    if (field === 'loc' || field === 'start' || field === 'end') continue
    const children = Array.isArray(child) ? child : [child]
    for (const item of children) {
      if (item && typeof item.type === 'string') forEachJsxElement(item, visit)
    }
  }
}

async function sourceFiles(directory) {
  const entries = await fs.readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter((entry) => entry.isFile() && /\.[jt]sx$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

/**
 * Returns the translation keys used as the placeholder of an element with a
 * fixed dir='ltr' (inputs for URLs, IDs and code), with the file they are in.
 */
async function leftToRightPlaceholderKeys(directory) {
  const keys = new Map()
  for (const file of await sourceFiles(directory)) {
    const ast = parse(await fs.readFile(file, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    })
    forEachJsxElement(ast.program, (element) => {
      const dir = attributeValue(element, 'dir')
      if (dir?.type !== 'StringLiteral' || dir.value !== 'ltr') return
      const placeholder = attributeValue(element, 'placeholder')
      for (const key of translationKeysIn(placeholder)) {
        if (!keys.has(key)) keys.set(key, path.relative(directory, file))
      }
    })
  }
  return keys
}

/**
 * A Persian placeholder inside a left-to-right input takes the input's
 * direction, which scrambles its word order. It must be one right-to-left
 * isolate (RLI ... PDI) so it reads in order while typed values stay LTR.
 */
function checkLeftToRightPlaceholders(faTranslation, placeholderKeys) {
  const findings = []
  for (const [key, file] of placeholderKeys) {
    const value = faTranslation[key]
    if (typeof value !== 'string' || !new RegExp(P).test(value)) continue
    if (value.startsWith(RLI) && value.endsWith(PDI)) continue
    findings.push({
      key,
      rule: 'ltr-placeholder-isolate',
      message: `placeholder of a dir='ltr' input (${file}); wrap the whole value in RLI (U+2067) and PDI (U+2069)`,
    })
  }
  return findings
}

async function main() {
  const args = process.argv.slice(2)
  const enFlag = args.indexOf('--en')
  const enPath = path.resolve(
    enFlag === -1 ? 'src/i18n/locales/en.json' : args[enFlag + 1]
  )
  const srcFlag = args.indexOf('--src')
  const flagIndexes = new Set(
    [enFlag, srcFlag].filter((i) => i !== -1).flatMap((i) => [i, i + 1])
  )
  const positional = args.filter((_, i) => !flagIndexes.has(i))
  const faPath = path.resolve(positional[0] ?? 'src/i18n/locales/fa.json')
  let srcDir
  if (srcFlag !== -1) srcDir = path.resolve(args[srcFlag + 1])
  else if (positional.length === 0) srcDir = path.resolve('src')

  const fa = JSON.parse(await fs.readFile(faPath, 'utf8')).translation ?? {}
  const en = JSON.parse(await fs.readFile(enPath, 'utf8')).translation ?? {}
  const findings = checkPersianTranslations(fa, en)
  if (srcDir) {
    findings.push(
      ...checkLeftToRightPlaceholders(
        fa,
        await leftToRightPlaceholderKeys(srcDir)
      )
    )
  }

  for (const finding of findings) {
    console.log(
      `${JSON.stringify(finding.key)}: [${finding.rule}] ${finding.message}`
    )
  }
  const keyCount = Object.keys(fa).length
  if (findings.length > 0) {
    console.log(
      `\ncheck-fa: ${findings.length} finding(s) in ${keyCount} keys (${faPath})`
    )
    process.exitCode = 1
    return
  }
  console.log(`check-fa: ${keyCount} keys, no findings (${faPath})`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
