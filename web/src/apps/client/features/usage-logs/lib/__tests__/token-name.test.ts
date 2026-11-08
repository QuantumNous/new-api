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

import { logTokenName } from '../format'

describe('usage log token name', () => {
  test('translates the name the gateway wrote when the log has no token', async () => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'zh',
      resources: { zh: { translation: { 'Model test': '模型测试' } } },
    })

    expect(
      logTokenName({ token_id: 0, token_name: 'Model test' }, i18n.t)
    ).toBe('模型测试')
  })

  test('keeps the name of a real token as written when it equals a translation key', async () => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'zh',
      resources: { zh: { translation: { 'Model test': '模型测试' } } },
    })

    expect(
      logTokenName({ token_id: 7, token_name: 'Model test' }, i18n.t)
    ).toBe('Model test')
  })
})
