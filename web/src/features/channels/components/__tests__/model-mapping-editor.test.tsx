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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { expect, test, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import { ModelMappingEditor } from '../model-mapping-editor'

test('external mapping changes update the editor without emitting an edit', () => {
  const onChange = vi.fn()
  const view = render(
    <ModelMappingEditor value='{"client-a":"upstream-a"}' onChange={onChange} />
  )
  expect(screen.getByDisplayValue('client-a')).toBeVisible()
  expect(screen.getByDisplayValue('upstream-a')).toBeVisible()

  view.rerender(
    <ModelMappingEditor value='{"client-b":"upstream-b"}' onChange={onChange} />
  )
  expect(screen.getByDisplayValue('client-b')).toBeVisible()
  expect(screen.getByDisplayValue('upstream-b')).toBeVisible()
  expect(screen.queryByDisplayValue('client-a')).not.toBeInTheDocument()
  expect(onChange).not.toHaveBeenCalled()
})

test('language changes preserve draft mappings and explain the same direction in JSON mode', async () => {
  const i18n = createInstance()
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en, zh },
    keySeparator: false,
    interpolation: { escapeValue: false },
  })
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <ModelMappingEditor value='' onChange={onChange} />
    </I18nextProvider>
  )
  await user.click(screen.getByRole('button', { name: 'Add Mapping' }))
  await user.type(screen.getByPlaceholderText('gpt-3.5-turbo'), 'client-alias')
  await user.type(
    screen.getByPlaceholderText('gpt-3.5-turbo-0125'),
    'provider-model'
  )

  await act(() => i18n.changeLanguage('zh'))
  expect(screen.getByText('请求模型名称')).toBeVisible()
  expect(screen.getByText('上游模型名称')).toBeVisible()
  expect(screen.getByDisplayValue('client-alias')).toBeVisible()
  expect(screen.getByDisplayValue('provider-model')).toBeVisible()

  await user.click(screen.getByRole('tab', { name: 'JSON' }))
  expect(
    screen.getByText('JSON 的键是请求模型名称，值是上游模型名称。')
  ).toBeVisible()
  expect(screen.getByRole('textbox', { name: '模型映射' })).toHaveValue(
    '{\n  "client-alias": "provider-model"\n}'
  )
  expect(onChange).toHaveBeenLastCalledWith(
    '{\n  "client-alias": "provider-model"\n}'
  )
})
