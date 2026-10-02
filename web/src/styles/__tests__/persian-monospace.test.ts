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

import { compile } from '@tailwindcss/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Monospace fonts such as DejaVu Sans Mono, Menlo and Courier New carry
// fixed-width Arabic glyphs, so Persian text inside `font-mono` or <code>
// rendered spaced out ("نا مشخص"). The browser picks a face per character:
// the first family in the stack whose @font-face unicode-range covers it,
// otherwise a system font. These tests resolve that choice against the
// stylesheet compiled by Tailwind, the same way the build does.

const STYLESHEET = path.resolve(import.meta.dirname, '../index.css')
const SYSTEM_FONT = 'system font'
const ZWNJ = String.fromCodePoint(0x200c)

let style: HTMLStyleElement
// jsdom's CSSOM drops `unicode-range`, so faces are read from the CSS text.
let fontFaces: Array<{ family: string; unicodeRange: string }> = []

function parseUnicodeRange(value: string): Array<[number, number]> {
  return value.split(',').map((part) => {
    const [start, end = start] = part.trim().replace(/^U\+/i, '').split('-')
    return [
      Number.parseInt(start.replaceAll('?', '0'), 16),
      Number.parseInt(end.replaceAll('?', 'F'), 16),
    ]
  })
}

function monoFaceFor(char: string): string {
  const stack = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-mono')
    .split(',')
    .map((family) => family.trim().replaceAll(/^["']|["']$/g, ''))
  const codePoint = char.codePointAt(0) ?? 0
  for (const family of stack) {
    const familyFaces = fontFaces.filter((face) => face.family === family)
    if (familyFaces.length === 0) return SYSTEM_FONT
    const covers = familyFaces.some((face) => {
      if (!face.unicodeRange) return true
      return parseUnicodeRange(face.unicodeRange).some(
        ([start, end]) => codePoint >= start && codePoint <= end
      )
    })
    if (covers) return family
  }
  return SYSTEM_FONT
}

beforeAll(async () => {
  const compiler = await compile(fs.readFileSync(STYLESHEET, 'utf8'), {
    base: path.dirname(STYLESHEET),
    onDependency: () => {},
  })
  const css = compiler.build(['font-mono'])
  fontFaces = Array.from(
    css.matchAll(/@font-face\s*\{([^}]*)\}/g),
    (match) => ({
      family: /font-family:\s*["']?([^"';]+)/.exec(match[1])?.[1] ?? '',
      unicodeRange: /unicode-range:\s*([^;]+)/.exec(match[1])?.[1].trim() ?? '',
    })
  )
  style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
}, 60_000)

afterAll(() => {
  style.remove()
  document.documentElement.removeAttribute('lang')
})

describe('Persian text in monospace contexts', () => {
  it('renders Persian letters, digits and ZWNJ with a Persian face when lang is fa', () => {
    document.documentElement.lang = 'fa'

    const faces = new Set(
      [...`نسخۀ نامشخص ۱۲۳ ی ک${ZWNJ}`]
        .filter((c) => c !== ' ')
        .map(monoFaceFor)
    )

    expect(faces.size).toBe(1)
    expect([...faces][0]).toMatch(/vazirmatn/i)
  })

  it('keeps version strings, code and keys on the system monospace font when lang is fa', () => {
    document.documentElement.lang = 'fa'

    const faces = new Set([...'v1.2.3-rc_key sk-AbZ09{}'].map(monoFaceFor))

    expect([...faces]).toEqual([SYSTEM_FONT])
  })

  it('leaves the monospace stack unchanged for other languages', () => {
    document.documentElement.lang = 'en'

    expect(monoFaceFor('ن')).toBe(SYSTEM_FONT)
    expect(monoFaceFor('v')).toBe(SYSTEM_FONT)
  })
})
