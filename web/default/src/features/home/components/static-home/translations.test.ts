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
﻿import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getStaticHomeText, STATIC_HOME_LANGUAGES } from './translations.ts'

const requiredKeys = [
  'home.static.nav.home',
  'home.static.notice.title',
  'home.static.common.loading',
  'home.static.hero.feature.stable.title',
  'home.static.hero.feature.fast.text',
  'home.static.why.models.title',
  'home.static.why.api.line2',
  'home.static.developer.openai.title',
  'home.static.pricing.developer.pricePrefix',
  'home.static.pricing.developer.priceValue',
  'home.static.pricing.developer.priceUnit',
  'home.static.pricing.developer.f1',
  'home.static.footer.faq',
] as const

describe('static home translations', () => {
  test('supports every language exposed by the language switcher', () => {
    assert.deepEqual(STATIC_HOME_LANGUAGES, ['en', 'zh', 'fr', 'ru', 'ja', 'vi'])
  })

  test('does not fall back to Chinese for non-Chinese languages', () => {
    for (const language of ['en', 'fr', 'ru', 'vi'] as const) {
      const t = getStaticHomeText(language)
      for (const key of requiredKeys) {
        const value = t(key)
        assert.doesNotMatch(value, /[\u4e00-\u9fff]/u, `${language} ${key}`)
        assert.doesNotMatch(value, /^home\.static\./u, `${language} ${key}`)
      }
    }
  })

  test('uses distinct localized homepage copy for enabled non-English languages', () => {
    assert.equal(getStaticHomeText('fr')('home.static.hero.feature.stable.title'), 'Stable et fiable')
    assert.equal(getStaticHomeText('ru')('home.static.hero.feature.stable.title'), 'Стабильно и надежно')
    assert.equal(getStaticHomeText('ja')('home.static.hero.feature.stable.title'), '安定・高信頼')
    assert.equal(getStaticHomeText('vi')('home.static.hero.feature.stable.title'), 'Ổn định và tin cậy')
  })
})
