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
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { expect, it } from 'vitest'

it('provides every IQ UI key in all seven locales with the same placeholders', () => {
  const root = path.resolve('src/features/iq-tests')
  const keys = new Set(
    readdirSync(root)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) =>
        [
          ...readFileSync(path.join(root, file), 'utf8').matchAll(
            /\bt\('([^']+)'/g
          ),
        ].map((match) => match[1])
      )
  )
  const placeholders = (value: string) =>
    [...value.matchAll(/{{\w+}}/g)].map((match) => match[0]).sort()
  for (const locale of ['en', 'zh', 'zh-TW', 'fr', 'ja', 'ru', 'vi']) {
    const translations = JSON.parse(
      readFileSync(path.resolve(`src/i18n/locales/${locale}.json`), 'utf8')
    ).translation as Record<string, string>
    for (const key of keys) {
      expect(translations[key], `${locale}: ${key}`).toBeTruthy()
      expect(placeholders(translations[key]), `${locale}: ${key}`).toEqual(
        placeholders(key)
      )
    }
  }
})
