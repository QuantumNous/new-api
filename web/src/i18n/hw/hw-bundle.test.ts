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
import { describe, expect, test } from 'vitest'

import { resources } from '../config'
import { withHwText } from '../hw'

const dir = path.resolve(__dirname, '../locales')
const hwDir = path.resolve(__dirname, '../hw')
const read = (base: string, name: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(base, name), 'utf8')).translation
// Our own files hold the keys themselves, without the `translation` wrapper.
const readHw = (name: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(hwDir, name), 'utf8'))
const hwFiles = fs
  .readdirSync(hwDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''))

// A locale code in config (zhCN) against its locale/hw file name (zh).
const CODES: Record<string, string> = { zhCN: 'zh', zhTW: 'zh-TW' }

describe('our own texts', () => {
  for (const file of hwFiles) {
    const language = Object.keys(CODES).find((code) => CODES[code] === file) ?? file

    test(`${language}: our own text wins and the upstream text stays`, () => {
      const upstream = read(dir, `${file}.json`)
      const hw = readHw(`${file}.json`)
      const merged = withHwText(language, { translation: upstream }).translation
      for (const [key, value] of Object.entries(hw)) {
        expect(merged[key], `hw: ${key}`).toBe(value)
      }
      for (const [key, value] of Object.entries(upstream)) {
        if (Object.hasOwn(hw, key)) continue
        expect(merged[key], `upstream: ${key}`).toBe(value)
      }
    })
  }

  test('a language without our own file keeps the upstream bundle untouched', () => {
    const bundle = { translation: { 'Sign in': 'Sign in' } }
    expect(withHwText('de', bundle)).toBe(bundle)
    expect(resources.en.translation['Sign in']).toBe('Sign in')
  })

  test('tr.json keeps every key readable through the merged English bundle', () => {
    const unknown = Object.keys(read(dir, 'tr.json')).filter(
      (key) => !Object.hasOwn(resources.en.translation, key)
    )
    expect(unknown).toEqual([])
  })
})
