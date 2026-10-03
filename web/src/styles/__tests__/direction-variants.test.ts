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
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

// Tailwind's own rtl: and ltr: variants use :dir(). For the default browser
// targets the build rewrites :dir() into a list of :lang() checks, so they
// followed the interface language instead of the page direction: a Persian
// page switched to left to right still got its rtl: styles. The stylesheet
// redefines both variants on the dir attribute alone.

const STYLESHEET = path.resolve(import.meta.dirname, '../index.css')
const CLASSES = ['rtl:rotate-180', 'ltr:translate-x-px', 'rtl:-translate-x-px']

let selectors: Map<string, string>
let page: HTMLElement | undefined

beforeAll(async () => {
  const compiler = await compile(fs.readFileSync(STYLESHEET, 'utf8'), {
    base: path.dirname(STYLESHEET),
    onDependency: () => {},
  })
  const css = compiler.build(CLASSES)
  selectors = new Map(
    CLASSES.map((name) => {
      const escaped = `.${name.replace(':', '\\:')}`
      const rule = css
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith(escaped) && line.endsWith('{'))
      if (!rule) throw new Error(`missing rule for ${name}`)
      return [name, rule.slice(0, -1).trim()]
    })
  )
}, 60_000)

afterEach(() => {
  page?.remove()
})

describe('direction variants', () => {
  it.each(CLASSES)(
    'keys %s on the dir attribute, leaving no :dir() or :lang() to rewrite',
    (name) => {
      const selector = selectors.get(name)

      expect(selector).not.toContain(':dir(')
      expect(selector).not.toContain(':lang(')
    }
  )

  it.each([
    ['en', 'ltr'],
    ['en', 'rtl'],
    ['fa', 'rtl'],
    ['fa', 'ltr'],
  ] as const)(
    'applies only the variant of the page direction with lang=%s and dir=%s',
    (lang, dir) => {
      page = document.createElement('div')
      page.setAttribute('lang', lang)
      page.setAttribute('dir', dir)
      page.innerHTML = `<span class="${CLASSES.join(' ')}"></span>`
      document.body.append(page)
      const icon = page.querySelector('span') as HTMLElement

      expect(icon.matches(selectors.get('rtl:rotate-180') ?? '')).toBe(
        dir === 'rtl'
      )
      expect(icon.matches(selectors.get('ltr:translate-x-px') ?? '')).toBe(
        dir === 'ltr'
      )
    }
  )
})
