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
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import en from '../../../../i18n/locales/en.json'
import fr from '../../../../i18n/locales/fr.json'
import ja from '../../../../i18n/locales/ja.json'
import ru from '../../../../i18n/locales/ru.json'
import vi from '../../../../i18n/locales/vi.json'
import zhTW from '../../../../i18n/locales/zh-TW.json'
import zh from '../../../../i18n/locales/zh.json'

const savingsTranslationKeys = [
  '{{coverage}} coverage',
  '{{count}} historical requests recalculated at current official prices',
] as const

const localeTranslations: Array<[string, Record<string, string>]> = [
  ['en', en.translation],
  ['fr', fr.translation],
  ['ja', ja.translation],
  ['ru', ru.translation],
  ['vi', vi.translation],
  ['zh-TW', zhTW.translation],
  ['zh', zh.translation],
]

describe('savings summary translations', () => {
  for (const [locale, translations] of localeTranslations) {
    it(`${locale} includes localized dynamic summary text`, () => {
      for (const key of savingsTranslationKeys) {
        assert.ok(translations[key], `${locale} is missing ${key}`)
        if (locale !== 'en') assert.notEqual(translations[key], key)
      }

      assert.ok(
        translations[savingsTranslationKeys[0]].includes('{{coverage}}')
      )
      assert.ok(translations[savingsTranslationKeys[1]].includes('{{count}}'))
    })
  }

  it('preserves review-approved savings terminology', () => {
    assert.equal(
      ru.translation[
        'Calculate estimated savings using official model prices.'
      ],
      'Рассчитывать оценочную экономию по официальным ценам моделей.'
    )
    assert.equal(
      ru.translation['Covered request actual cost'],
      'Фактическая стоимость охваченных запросов'
    )
    assert.equal(ru.translation['Covered requests'], 'Охваченные запросы')
    assert.equal(
      ru.translation['Recalculate legacy usage logs'],
      'Пересчитать устаревшие журналы использования'
    )
    assert.equal(
      vi.translation['Official Price Updated'],
      'Giá chính thức đã được cập nhật'
    )
    assert.equal(
      vi.translation['Official price updated {{time}}'],
      'Giá chính thức được cập nhật lúc {{time}}'
    )
    assert.equal(
      zhTW.translation[
        'Show the savings summary and trend on the user dashboard.'
      ],
      '在用戶儀表板中顯示節省彙總和趨勢。'
    )
    assert.equal(
      zhTW.translation[
        'Treat local model marketplace prices as official reference prices.'
      ],
      '將本地模型廣場價格視為官方參考價格。'
    )
    assert.equal(
      zhTW.translation[
        'Uses local official pricing from the model marketplace by default; official_prices is only needed for overrides.'
      ],
      '預設使用模型廣場中的本地官方定價；official_prices 僅用於覆寫例外模型。'
    )
  })
})
