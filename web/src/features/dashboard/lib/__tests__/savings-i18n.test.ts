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
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'

interface LocaleFile {
  translation: Record<string, string>
}

const require = createRequire(import.meta.url)
const en = require('../../../../i18n/locales/en.json') as LocaleFile
const fr = require('../../../../i18n/locales/fr.json') as LocaleFile
const ja = require('../../../../i18n/locales/ja.json') as LocaleFile
const ru = require('../../../../i18n/locales/ru.json') as LocaleFile
const vi = require('../../../../i18n/locales/vi.json') as LocaleFile
const zhTW = require('../../../../i18n/locales/zh-TW.json') as LocaleFile
const zh = require('../../../../i18n/locales/zh.json') as LocaleFile

const savingsTranslationKeys = [
  'About official pricing estimates',
  '{{coverage}} coverage',
  'Historical requests recalculated at current official prices: {{count}}',
  'Estimated from official public pricing',
  'Historical savings backfill failed; results are incomplete.',
  'Historical usage has not been backfilled',
  'Last 24 hours',
  'Lifetime savings counted so far',
  'Official price confirmation is required while savings estimates are enabled.',
  'Official prices are confirmed snapshots from the model marketplace; estimates are for cost comparison only.',
  'Reload savings data',
  'Required while savings estimates are enabled.',
  'Savings data update failed',
  'System historical data counting is paused',
  'System historical data is being counted',
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

      assert.ok(translations['{{coverage}} coverage'].includes('{{coverage}}'))
      assert.ok(
        translations[
          'Historical requests recalculated at current official prices: {{count}}'
        ].includes('{{count}}')
      )
      assert.equal(
        translations[
          '{{count}} historical requests recalculated at current official prices'
        ],
        undefined
      )
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
    assert.equal(zh.translation['Estimated: {{count}}'], '已估算：{{count}}')
    assert.equal(zhTW.translation['Estimated: {{count}}'], '已估算：{{count}}')
    assert.equal(
      ru.translation[
        'Aggregate new usage into a frozen lifetime savings total.'
      ],
      'Учитывать новое использование в зафиксированной общей сумме экономии за всё время.'
    )
    assert.equal(
      ru.translation[
        'Enable and save lifetime savings before starting a backfill.'
      ],
      'Включите и сохраните настройку накопленной экономии перед запуском пересчёта.'
    )
    assert.equal(
      ru.translation[
        'Uses local official pricing from the model marketplace by default; official_prices is only needed for overrides.'
      ],
      'По умолчанию используются локальные официальные цены из каталога моделей; official_prices нужен только для переопределений.'
    )
  })
})
