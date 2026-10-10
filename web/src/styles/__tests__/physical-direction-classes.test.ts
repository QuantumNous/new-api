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
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import allowlist from './physical-direction-allowlist.json'

// Physical direction classes (ml-*, pr-*, left-*, text-right, border-l,
// rounded-tl ...) do not mirror in right-to-left languages. Their logical
// counterparts (ms-*, pe-*, start-*, text-end, border-s, rounded-ss ...)
// render the same in left-to-right languages and mirror in right-to-left
// ones. A physical class outside tests must be listed, with a reason, in
// physical-direction-allowlist.json. Classes behind an rtl: or ltr: variant
// are direction-specific on purpose and are not reported.

type Finding = { file: string; line: number; className: string }
type AllowlistEntry = { file: string; classes: string[]; reason: string }

const SRC_DIR = path.resolve(import.meta.dirname, '../..')

// Spacing and inset values are numbers, fractions, keywords or arbitrary
// values, so prose such as "left-to-right" is not taken for a class.
const PHYSICAL_UTILITY =
  /^-?(?:(?:m[lr]|p[lr]|left|right|scroll-[mp][lr])-(?:\d+(?:\.\d+)?|\d+\/\d+|px|full|auto|\[.+\]|\(.+\))|(?:border|rounded)-(?:[lr]|[tb][lr])(?:-.+)?|text-(?:left|right)|float-(?:left|right))$/

// Splits `a:[&>b:c]:d` at the colons that are not inside [] or ().
function splitVariants(token: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of token) {
    if (char === '[' || char === '(') depth++
    if (char === ']' || char === ')') depth--
    if (char === ':' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
}

function physicalClassesInSource(source: string) {
  const found: { line: number; className: string }[] = []
  source.split('\n').forEach((text, index) => {
    const trimmed = text.trim()
    if (/^(\/\/|\/\*|\*)/.test(trimmed)) return
    const code = text.replaceAll(/\/\*.*?\*\//g, '')
    for (const token of code.split(/[\s'"`]+/)) {
      let className = token.replaceAll(/^[{(,]+|[,;}]+$/g, '')
      // Drop a call's closing parentheses, keep those of a (--var) value.
      while (
        className.endsWith(')') &&
        className.split(')').length > className.split('(').length
      ) {
        className = className.slice(0, -1)
      }
      const parts = splitVariants(className)
      const utility = parts.at(-1)?.replaceAll(/^!|!$/g, '') ?? ''
      const variants = parts.slice(0, -1)
      if (variants.some((variant) => variant === 'rtl' || variant === 'ltr')) {
        continue
      }
      if (PHYSICAL_UTILITY.test(utility)) {
        found.push({ line: index + 1, className })
      }
    }
  })
  return found
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'locales'
        ? []
        : sourceFiles(fullPath)
    }
    return /\.(tsx?|css)$/.test(entry.name) && !entry.name.includes('.test.')
      ? [fullPath]
      : []
  })
}

function scanSources(): Finding[] {
  return sourceFiles(SRC_DIR).flatMap((fullPath) => {
    const file = path.relative(SRC_DIR, fullPath).split(path.sep).join('/')
    return physicalClassesInSource(fs.readFileSync(fullPath, 'utf8')).map(
      (hit) => ({ file, ...hit })
    )
  })
}

function allowedCounts(entries: AllowlistEntry[]) {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const className of entry.classes) {
      const key = `${entry.file} ${className}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

describe('physical direction classes', () => {
  it('reports physical classes but not logical, rtl:/ltr: or commented ones', () => {
    const source = [
      "<div className='ms-2 pe-1 start-0 text-end border-s rounded-ss-md' />",
      "<div className='mr-2 hover:pl-1 -left-2 text-right border-l-2 rounded-tr-lg sm:rounded-r-(--radius)' />",
      "<span className='rtl:rotate-180 rtl:mr-1 ltr:left-0 data-[side=left]:-right-1!' />",
      '// comment mentioning pl-2 and left-to-right',
      "<p>{t('Choose between left-to-right or right-to-left')}</p>",
      "{/* text-left in a JSX comment */} <p className={cn('ml-auto', p.className)} />",
    ].join('\n')

    expect(physicalClassesInSource(source)).toEqual([
      { line: 2, className: 'mr-2' },
      { line: 2, className: 'hover:pl-1' },
      { line: 2, className: '-left-2' },
      { line: 2, className: 'text-right' },
      { line: 2, className: 'border-l-2' },
      { line: 2, className: 'rounded-tr-lg' },
      { line: 2, className: 'sm:rounded-r-(--radius)' },
      { line: 3, className: 'data-[side=left]:-right-1!' },
      { line: 6, className: 'ml-auto' },
    ])
  })

  it('finds no physical class under src that the allowlist does not list', () => {
    const allowed = allowedCounts(allowlist)
    const unexpected: string[] = []
    for (const finding of scanSources()) {
      const key = `${finding.file} ${finding.className}`
      const remaining = allowed.get(key) ?? 0
      if (remaining > 0) {
        allowed.set(key, remaining - 1)
      } else {
        unexpected.push(`${finding.file}:${finding.line} ${finding.className}`)
      }
    }

    expect(
      unexpected,
      'Use the logical class (ms-, me-, ps-, pe-, start-, end-, text-start, text-end, border-s, border-e, rounded-s, rounded-e, rounded-ss ...), or list the class with a reason in physical-direction-allowlist.json'
    ).toEqual([])
  })

  it('lists only classes that still exist, each with a reason', () => {
    const remaining = allowedCounts(allowlist)
    for (const finding of scanSources()) {
      const key = `${finding.file} ${finding.className}`
      remaining.set(key, (remaining.get(key) ?? 0) - 1)
    }
    const stale = [...remaining].filter(([, count]) => count > 0)

    expect(stale, 'Remove allowlist classes that are no longer used').toEqual(
      []
    )
    for (const entry of allowlist) {
      expect(entry.reason.trim(), entry.file).not.toBe('')
    }
  })
})
