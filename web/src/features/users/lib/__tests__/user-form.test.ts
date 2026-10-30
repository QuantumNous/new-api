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
import { expect, it } from 'vitest'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

import {
  USER_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformUserToFormDefaults,
  userFormSchema,
} from '../user-form'

it('new users inherit the configured concurrency limit when the field is empty', () => {
  expect(USER_FORM_DEFAULT_VALUES.max_concurrency).toBeUndefined()
  expect(
    transformFormDataToPayload({
      ...USER_FORM_DEFAULT_VALUES,
      username: 'new-user',
    })
  ).toHaveProperty('max_concurrency', undefined)
  const serialized = JSON.stringify(
    transformFormDataToPayload({
      ...USER_FORM_DEFAULT_VALUES,
      username: 'new-user',
    })
  )
  expect(serialized).not.toContain('"max_concurrency"')
})

it.each([-1, 1.5, 2147483648, Number.NaN])(
  'rejects an invalid concurrency limit of %s',
  (limit) => {
    const result = userFormSchema.safeParse({
      ...USER_FORM_DEFAULT_VALUES,
      username: 'user',
      max_concurrency: limit,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['max_concurrency'],
        message:
          'Maximum concurrency must be an integer between 0 and 2147483647',
      }),
    ])
  }
)

const resources = { en, fr, ja, ru, vi, zh, 'zh-TW': zhTW }

it.each(Object.entries(resources))(
  'translates concurrency validation errors after switching to %s',
  async (language, resource) => {
    const translations = createInstance()
    await translations.init({ lng: 'en', fallbackLng: 'en', resources })
    const result = userFormSchema.safeParse({
      ...USER_FORM_DEFAULT_VALUES,
      username: 'user',
      max_concurrency: -1,
    })
    const key =
      'Maximum concurrency must be an integer between 0 and 2147483647'
    const message = result.error?.issues[0]?.message ?? ''
    expect(message).toBe(key)
    expect(translations.t(message)).toBe(key)

    await translations.changeLanguage(language)
    expect(resource.translation).toHaveProperty(key)
    expect(translations.t(message)).toBe(resource.translation[key])
    if (language !== 'en') {
      expect(translations.t(message)).not.toBe(key)
    }
  }
)

it.each([0, 5])(
  'preserves an explicit concurrency limit of %s when creating or updating a user',
  (limit) => {
    const data = {
      ...USER_FORM_DEFAULT_VALUES,
      username: 'user',
      max_concurrency: limit,
    }
    expect(userFormSchema.safeParse(data).success).toBe(true)
    expect(transformFormDataToPayload(data)).toHaveProperty(
      'max_concurrency',
      limit
    )
    expect(transformFormDataToPayload(data, 2)).toHaveProperty(
      'max_concurrency',
      limit
    )
    expect(
      transformUserToFormDefaults({
        id: 2,
        username: 'user',
        display_name: '',
        role: 1,
        status: 1,
        quota: 0,
        used_quota: 0,
        request_count: 0,
        group: 'default',
        max_concurrency: limit,
      })
    ).toHaveProperty('max_concurrency', limit)
  }
)
