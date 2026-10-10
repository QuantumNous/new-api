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
import { createInstance } from 'i18next'
import { describe, expect, test } from 'vitest'

import { formatGroupDetail } from '../group-detail'

describe('model group selector group detail', () => {
  test('translates the backend description key and the auto ratio when the language is Chinese', async () => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'zh',
      resources: {
        zh: {
          translation: {
            'User group': '用户分组',
            Auto: '自动',
            'Ratio: {{value}}': '倍率：{{value}}',
          },
        },
      },
    })

    expect(
      formatGroupDetail({ desc: 'User group', ratio: 'auto' }, i18n.t)
    ).toBe('用户分组 · 倍率：自动')
  })

  test('keeps an administrator description and a numeric ratio as written', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })

    expect(formatGroupDetail({ desc: 'VIP 专线', ratio: 1.5 }, i18n.t)).toBe(
      'VIP 专线 · Ratio: 1.5'
    )
    expect(formatGroupDetail({ description: 'No ratio' }, i18n.t)).toBe(
      'No ratio'
    )
  })
})
