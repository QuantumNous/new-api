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
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

// Code, keyboard keys and sample output are usually left-to-right text. On a
// right-to-left page a path such as `/api/ratio` or a list of regexes would
// have its slashes and punctuation moved to the other end. The stylesheet
// isolates them with `unicode-bidi: plaintext`, which takes the direction
// from their content, and leaves `direction` alone so logical insets such as
// a key cap pinned with `end-*` keep following the page.

const STYLESHEET = path.resolve(import.meta.dirname, '../index.css')

let style: HTMLStyleElement
let host: HTMLElement

beforeAll(async () => {
  const compiler = await compile(fs.readFileSync(STYLESHEET, 'utf8'), {
    base: path.dirname(STYLESHEET),
    onDependency: () => {},
  })
  style = document.createElement('style')
  style.textContent = compiler.build([])
  document.head.append(style)
}, 60_000)

afterEach(() => {
  host?.remove()
})

afterAll(() => {
  style.remove()
})

function renderInside(dir: 'rtl' | 'ltr', html: string): HTMLElement {
  host = document.createElement('div')
  host.setAttribute('dir', dir)
  host.innerHTML = html
  document.body.append(host)
  return host
}

function styleOf(root: HTMLElement, selector: string): CSSStyleDeclaration {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`missing ${selector}`)
  return getComputedStyle(element)
}

describe('code direction', () => {
  it('isolates inline code with its own text direction on a right-to-left page', () => {
    const root = renderInside('rtl', '<p>از طریق <code>/api/ratio</code></p>')

    expect(styleOf(root, 'code').unicodeBidi).toBe('plaintext')
  })

  it('keeps the page direction for positioning and alignment', () => {
    const root = renderInside('rtl', '<kbd>⌘K</kbd>')

    expect(styleOf(root, 'kbd').direction).not.toBe('ltr')
  })

  it('applies to keyboard keys and sample output too', () => {
    const root = renderInside('rtl', '<kbd>Ctrl+K</kbd><samp>200 OK</samp>')

    expect(styleOf(root, 'kbd').unicodeBidi).toBe('plaintext')
    expect(styleOf(root, 'samp').unicodeBidi).toBe('plaintext')
  })

  it('isolates preformatted blocks, such as JSON and logs, on a right-to-left page', () => {
    const root = renderInside('rtl', '<pre>{"model": "gpt-4.1"}</pre>')

    expect(styleOf(root, 'pre').unicodeBidi).toBe('plaintext')
  })

  it('leaves a preformatted block with an explicit dir alone', () => {
    const root = renderInside('rtl', '<pre dir="ltr">GET /v1/models</pre>')

    expect(styleOf(root, 'pre').unicodeBidi).not.toBe('plaintext')
  })

  it('leaves a preformatted block inside a left-to-right island alone', () => {
    // The JSON editor draws its highlighted text in a `pre` under a
    // transparent textarea. A line starting with a Persian key must be laid
    // out left to right in both, or the caret no longer matches the text.
    const root = renderInside(
      'rtl',
      '<div dir="ltr"><pre>"چت فارسی": "https://example.com"</pre></div>'
    )

    expect(styleOf(root, 'pre').unicodeBidi).not.toBe('plaintext')
  })

  it('adds nothing to preformatted blocks on a left-to-right page', () => {
    const root = renderInside('ltr', '<pre>{"model": "gpt-4.1"}</pre>')

    expect(styleOf(root, 'pre').unicodeBidi).not.toBe('plaintext')
  })

  it('respects an explicit dir attribute on the element', () => {
    const root = renderInside('rtl', '<code dir="rtl">مقدار</code>')

    expect(styleOf(root, 'code').direction).toBe('rtl')
    expect(styleOf(root, 'code').unicodeBidi).not.toBe('plaintext')
  })

  it('adds nothing on a left-to-right page', () => {
    const root = renderInside('ltr', '<p>via <code>/api/ratio</code></p>')

    expect(styleOf(root, 'code').unicodeBidi).not.toBe('plaintext')
  })
})
