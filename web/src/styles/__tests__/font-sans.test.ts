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
import { createRequire } from 'node:module'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// The sans font is loaded from a @fontsource package, which registers its
// own family name. `--font-sans` must ask for that name, or no @font-face
// matches and the browser falls back to its generic sans-serif.

const STYLES_DIR = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

function unquote(family: string): string {
  return family.trim().replaceAll(/^["']|["']$/g, '')
}

function importedSansPackage(): string {
  const indexCss = fs.readFileSync(path.join(STYLES_DIR, 'index.css'), 'utf8')
  const match =
    /@import\s+['"](@fontsource(?:-variable)?\/[^'"]*sans[^'"]*)['"]/.exec(
      indexCss
    )
  if (!match) throw new Error('index.css imports no @fontsource sans package')
  return match[1]
}

function registeredFamilies(packageName: string): Set<string> {
  const css = fs.readFileSync(require.resolve(packageName), 'utf8')
  const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) =>
    unquote(m[1])
  )
  return new Set(families)
}

function fontSansStack(): string[] {
  const themeCss = fs.readFileSync(path.join(STYLES_DIR, 'theme.css'), 'utf8')
  const match = /--font-sans:\s*([^;]+);/.exec(themeCss)
  if (!match) throw new Error('theme.css declares no --font-sans')
  return match[1].split(',').map(unquote)
}

describe('--font-sans', () => {
  it('lists the family registered by the imported @fontsource package first', () => {
    const families = registeredFamilies(importedSansPackage())

    expect(families.size).toBe(1)
    expect(fontSansStack()[0]).toBe([...families][0])
  })
})
