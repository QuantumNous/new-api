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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { TaskPluginOption } from '@/features/channels/api'
import type { RequestPluginInstance } from '@/features/task-plugins/types'
import { api } from '@/lib/api'

import { RequestProcessing } from '..'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const filterPlugin: TaskPluginOption = {
  key: 'request-filter',
  name: 'Request filter',
  name_i18n: { en: 'Request filter', zh: '请求过滤' },
  icon: 'text:RF',
  models: [],
  task: false,
  provider: false,
  transform: true,
  configSchema: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        title: { en: 'Refusal message', zh: '拒绝提示' },
        default: 'Blocked by policy',
      },
      mode: {
        type: 'string',
        title: 'Action',
        enum: ['reject', 'log'],
        enumTitles: ['Refuse', 'Log only'],
        default: 'reject',
      },
      limit: { type: 'integer', title: 'Limit', examples: [10] },
      caseSensitive: {
        type: 'boolean',
        title: 'Case sensitive',
        default: true,
      },
      categories: {
        type: 'array',
        title: 'Categories',
        items: {
          type: 'string',
          title: 'Category',
          enum: ['email', 'phone'],
          enumTitles: ['Email', 'Phone'],
        },
        default: ['email'],
      },
      keywords: {
        type: 'array',
        title: 'Keywords',
        items: { type: 'string', title: 'Keyword' },
        examples: [['secret', 'password']],
      },
      rules: {
        type: 'array',
        title: 'Rules',
        items: { type: 'object', title: 'Rule' },
        examples: [[{ id: 'r1', pattern: 'x' }]],
      },
      notes: { type: 'string', title: 'Notes', format: 'textarea' },
    },
  },
}

const taskPlugin: TaskPluginOption = {
  key: 'kling',
  name: 'Kling',
  models: ['kling-v1'],
  task: true,
  provider: false,
}

let instances: RequestPluginInstance[]
let client: QueryClient

beforeEach(() => {
  instances = [
    {
      id: 'rp_aaaa1111',
      name: 'Block secrets',
      plugin: 'request-filter',
      enabled: true,
      global: true,
      groups: [],
      models: [],
      config: { message: 'No' },
    },
    {
      id: 'rp_bbbb2222',
      name: 'VIP filter',
      plugin: 'request-filter',
      enabled: false,
      global: false,
      groups: ['vip', 'svip'],
      models: ['gpt-4o', 'claude-sonnet-4-5'],
      config: {},
    },
    {
      id: 'rp_cccc3333',
      name: 'Channel filter',
      plugin: 'request-filter',
      enabled: true,
      global: false,
      groups: [],
      models: [],
      config: {},
    },
  ]
  // jsdom cannot draw the sample image of the editor's try panel.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/request_plugin/instances') {
      return { data: { success: true, data: { instances } } }
    }
    if (url === '/api/task_plugin_options') {
      return { data: { success: true, data: [filterPlugin, taskPlugin] } }
    }
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default', 'vip', 'svip'] } }
    }
    if (url === '/api/channel/models_enabled') {
      return {
        data: {
          success: true,
          data: ['gpt-4o', 'claude-sonnet-4-5', 'gemini-2.5-flash'],
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

function mockSave() {
  return vi.spyOn(api, 'put').mockImplementation(async (_url, body) => {
    const saved = (body as { instances: RequestPluginInstance[] }).instances
    return {
      data: {
        success: true,
        data: {
          instances: saved.map((instance) => ({
            ...instance,
            id: instance.id || 'rp_new00001',
          })),
        },
      },
    }
  })
}

function renderInstances(language?: ReturnType<typeof createInstance>) {
  const view = (
    <QueryClientProvider client={client}>
      <RequestProcessing />
    </QueryClientProvider>
  )
  return render(
    language ? <I18nextProvider i18n={language}>{view}</I18nextProvider> : view
  )
}

async function openNewInstance() {
  const user = userEvent.setup()
  renderInstances()
  await screen.findByText('Block secrets')
  await user.click(screen.getByRole('button', { name: 'Add' }))
  const picker = await screen.findByRole('dialog', {
    name: 'Add request processing',
  })
  await user.click(
    within(picker).getByRole('button', { name: /Request filter/ })
  )
  return { user, dialog: screen.getByRole('dialog') }
}

test('the page shows its title and each instance in order with its scope and plugin', async () => {
  renderInstances()
  await screen.findByText('Block secrets')

  expect(
    screen.getByRole('heading', { name: 'Request processing' })
  ).toBeVisible()

  const rows = screen.getAllByRole('row').slice(1)
  expect(
    rows.map((row) => within(row).getAllByRole('cell')[1].textContent)
  ).toEqual(['Block secrets', 'VIP filter', 'Channel filter'])
  expect(rows[0]).toHaveTextContent('All requests')
  expect(rows[0]).toHaveTextContent('Request filter')
  expect(rows[1]).toHaveTextContent('vip, svip')
  expect(rows[1]).toHaveTextContent('Models: gpt-4o, claude-sonnet-4-5')
  expect(rows[0]).not.toHaveTextContent('Models:')
  expect(rows[2]).toHaveTextContent('Channels only')
  expect(
    within(rows[1]).getByRole('switch', { name: 'Enable VIP filter' })
  ).not.toBeChecked()
})

test('moving an instance down saves the whole list in the new order', async () => {
  const put = mockSave()
  const user = userEvent.setup()
  renderInstances()
  await screen.findByText('Block secrets')

  expect(
    screen.getByRole('button', { name: 'Move Block secrets up' })
  ).toBeDisabled()
  await user.click(
    screen.getByRole('button', { name: 'Move Block secrets down' })
  )

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  expect(put).toHaveBeenCalledWith(
    '/api/request_plugin/instances',
    { instances: [instances[1], instances[0], instances[2]] },
    expect.anything()
  )
  await waitFor(() =>
    expect(
      within(screen.getAllByRole('row')[1]).getAllByRole('cell')[1]
    ).toHaveTextContent('VIP filter')
  )
})

test('deleting an instance after confirmation saves the list without it', async () => {
  const put = mockSave()
  const user = userEvent.setup()
  renderInstances()
  await screen.findByText('Block secrets')

  await user.click(screen.getByRole('button', { name: 'Delete VIP filter' }))
  const confirm = await screen.findByRole('alertdialog', {
    name: 'Delete instance?',
  })
  await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  expect(put.mock.calls[0][1]).toEqual({
    instances: [instances[0], instances[2]],
  })
})

test('adding an instance starts from the plugin cards and can go back to them', async () => {
  const user = userEvent.setup()
  renderInstances()
  await screen.findByText('Block secrets')
  await user.click(screen.getByRole('button', { name: 'Add' }))
  const picker = await screen.findByRole('dialog', {
    name: 'Add request processing',
  })

  const card = within(picker).getByRole('button', { name: /Request filter/ })
  expect(card).toHaveTextContent('3 added')
  expect(card).toHaveTextContent('Refuses the request when it fails')
  expect(within(picker).queryByRole('button', { name: /Kling/ })).toBeNull()
  await user.click(card)
  await user.click(screen.getByRole('button', { name: 'Other plugins' }))

  expect(
    await screen.findByRole('dialog', { name: 'Add request processing' })
  ).toBeVisible()
})

test('a new instance is named after its plugin and can be renamed in its title', async () => {
  const put = mockSave()
  const { user, dialog } = await openNewInstance()

  await user.click(within(dialog).getByRole('button', { name: 'Rename' }))
  const name = within(dialog).getByRole('textbox', { name: 'Name' })
  expect(name).toHaveValue('Request filter')
  await user.clear(name)
  await user.type(name, 'Block payroll{Enter}')
  expect(within(dialog).queryByRole('textbox', { name: 'Name' })).toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  const saved = (put.mock.calls[0][1] as { instances: RequestPluginInstance[] })
    .instances
  expect(saved[3]).toMatchObject({
    name: 'Block payroll',
    enabled: true,
    global: true,
    groups: [],
  })
})

test('a new instance renders every config field type with the schema defaults prefilled', async () => {
  const { dialog } = await openNewInstance()

  expect(
    within(dialog).getByRole('textbox', { name: 'Refusal message' })
  ).toHaveValue('Blocked by policy')
  expect(
    within(dialog).getByRole('combobox', { name: 'Action' })
  ).toHaveTextContent('Refuse')
  const limit = within(dialog).getByRole('spinbutton', { name: 'Limit' })
  expect(limit).toHaveValue(null)
  expect(limit).toHaveAttribute('placeholder', '10')
  expect(
    within(dialog).getByRole('switch', { name: 'Case sensitive' })
  ).toBeChecked()
  expect(within(dialog).getByRole('button', { name: 'Email' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(within(dialog).getByRole('button', { name: 'Phone' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  expect(
    within(dialog).getByRole('textbox', { name: 'Keywords' })
  ).toHaveAttribute('placeholder', 'secret\npassword')
  const rules = within(dialog).getByRole('textbox', { name: 'Rules' })
  expect(rules).toHaveValue('')
  expect(within(dialog).getByText(/"pattern": "x"/)).toBeVisible()
  expect(within(dialog).getByRole('textbox', { name: 'Notes' }).tagName).toBe(
    'TEXTAREA'
  )
})

test('scope and config values reach the saved list', async () => {
  const put = mockSave()
  const { user, dialog } = await openNewInstance()

  expect(
    within(dialog).getByText('Refuses the request when it fails')
  ).toBeVisible()
  await user.click(within(dialog).getByRole('radio', { name: /Chosen groups/ }))
  await user.click(
    within(dialog).getByRole('combobox', { name: 'Select groups' })
  )
  await user.click(await screen.findByRole('option', { name: 'vip' }))
  await user.keyboard('{Escape}')
  fireEvent.change(
    within(dialog).getByRole('textbox', { name: 'Refusal message' }),
    { target: { value: 'Custom refusal' } }
  )
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Limit' }), {
    target: { value: '25' },
  })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Keywords' }), {
    target: { value: 'alpha\n\n beta ' },
  })
  fireEvent.input(within(dialog).getByRole('textbox', { name: 'Rules' }), {
    target: { value: '[{"id":"r1","pattern":"a+"}]' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  const saved = (put.mock.calls[0][1] as { instances: RequestPluginInstance[] })
    .instances
  expect(saved.slice(0, 3)).toEqual(instances)
  expect(saved[3]).toEqual({
    id: '',
    name: 'Request filter',
    plugin: 'request-filter',
    enabled: true,
    global: false,
    groups: ['vip'],
    models: [],
    config: {
      message: 'Custom refusal',
      mode: 'reject',
      limit: 25,
      caseSensitive: true,
      categories: ['email'],
      keywords: ['alpha', 'beta'],
      rules: [{ id: 'r1', pattern: 'a+' }],
    },
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('chosen groups need at least one group before the instance saves', async () => {
  const put = mockSave()
  const { user, dialog } = await openNewInstance()

  await user.click(within(dialog).getByRole('radio', { name: /Chosen groups/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(within(dialog).getByText('Pick at least one group')).toBeVisible()
  expect(put).not.toHaveBeenCalled()
  await user.click(
    within(dialog).getByRole('radio', { name: /Channels that add it/ })
  )
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  const saved = (put.mock.calls[0][1] as { instances: RequestPluginInstance[] })
    .instances
  expect(saved[3]).toMatchObject({ global: false, groups: [] })
})

test('an instance for chosen groups opens with those groups picked', async () => {
  const user = userEvent.setup()
  renderInstances()
  await screen.findByText('VIP filter')

  await user.click(screen.getByRole('button', { name: 'Edit VIP filter' }))
  const dialog = await screen.findByRole('dialog')

  expect(
    within(dialog).getByRole('radio', { name: /Chosen groups/ })
  ).toBeChecked()
  expect(
    within(dialog).getByRole('radio', { name: /Chosen models/ })
  ).toBeChecked()
  expect(within(dialog).getByText('gpt-4o')).toBeVisible()
  expect(within(dialog).getByText('claude-sonnet-4-5')).toBeVisible()
  expect(
    within(dialog).getByRole('switch', { name: 'Enabled' })
  ).not.toBeChecked()
  expect(
    within(dialog).queryByRole('button', { name: 'Other plugins' })
  ).toBeNull()
})

test('chosen models, picked or typed in, reach the saved instance', async () => {
  const put = mockSave()
  const { user, dialog } = await openNewInstance()

  expect(
    within(dialog).getByRole('radio', { name: /All models/ })
  ).toBeChecked()
  await user.click(within(dialog).getByRole('radio', { name: /Chosen models/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(within(dialog).getByText('Pick at least one model')).toBeVisible()
  expect(put).not.toHaveBeenCalled()

  const picker = within(dialog).getByRole('combobox', {
    name: 'Select models or add custom ones',
  })
  await user.click(picker)
  await user.click(await screen.findByRole('option', { name: 'gpt-4o' }))
  await user.type(picker, 'my-model{Enter}')
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  const saved = (put.mock.calls[0][1] as { instances: RequestPluginInstance[] })
    .instances
  expect(saved[3]).toMatchObject({
    global: true,
    models: ['gpt-4o', 'my-model'],
  })
})

test('switching back to all models saves an empty model list', async () => {
  instances[1] = { ...instances[1], config: { message: 'No' } }
  const put = mockSave()
  const user = userEvent.setup()
  renderInstances()
  await screen.findByText('VIP filter')

  await user.click(screen.getByRole('button', { name: 'Edit VIP filter' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('radio', { name: /All models/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  const saved = (put.mock.calls[0][1] as { instances: RequestPluginInstance[] })
    .instances
  expect(saved[1]).toMatchObject({ groups: ['vip', 'svip'], models: [] })
})

test('a config the gateway rejects keeps the editor open with its message', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({
    data: {
      success: false,
      message: 'Rule "r1" has an invalid regular expression',
    },
  })
  const { user, dialog } = await openNewInstance()

  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(
    await within(dialog).findByText(
      'Rule "r1" has an invalid regular expression'
    )
  ).toBeVisible()
  expect(screen.getByRole('dialog')).toBeVisible()
})

test('malformed JSON in a config field is reported on that field and nothing is saved', async () => {
  const put = mockSave()
  const { user, dialog } = await openNewInstance()

  fireEvent.input(within(dialog).getByRole('textbox', { name: 'Rules' }), {
    target: { value: '[{' },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(within(dialog).getByRole('alert')).toHaveTextContent('Invalid JSON')
  expect(
    within(dialog).getByRole('textbox', { name: 'Rules' })
  ).toHaveAttribute('aria-invalid', 'true')
  expect(put).not.toHaveBeenCalled()
})

test('plugin names follow the interface language when the plugin has one', async () => {
  const language = createInstance()
  await language.init({
    lng: 'zh',
    fallbackLng: 'en',
    resources: { zh: { translation: {} } },
  })
  renderInstances(language)
  await screen.findByText('Block secrets')

  expect(screen.getAllByRole('row')[1]).toHaveTextContent('请求过滤')
  expect(screen.queryByText('Request filter')).toBeNull()
})

test('an instance whose plugin is disabled or removed is marked in the list', async () => {
  instances[2] = { ...instances[2], plugin: 'removed-plugin' }
  renderInstances()
  await screen.findByText('Block secrets')

  const rows = screen.getAllByRole('row').slice(1)
  expect(await within(rows[2]).findByText('Plugin disabled')).toBeVisible()
  expect(within(rows[0]).queryByText('Plugin disabled')).toBeNull()
})
