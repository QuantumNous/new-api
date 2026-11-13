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
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { TaskPluginOption } from '@/features/channels/api'

import { RequestPluginInstanceEditor } from '../components/request-plugin-instance-editor'
import type { RequestPluginInstance } from '../types'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const imagePlugin: TaskPluginOption = {
  key: 'image-compress',
  name: 'Image compress',
  models: [],
  task: false,
  provider: false,
  transform: true,
  optional: true,
  configSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        title: 'Mode',
        enum: ['lossless', 'lossy'],
        enumTitles: ['Lossless', 'Lossy'],
        default: 'lossless',
      },
      minBytes: {
        type: 'integer',
        title: 'Minimum image size',
        unit: 'byte',
        minimum: 0,
        default: 512000,
      },
      maxSide: {
        type: 'integer',
        title: 'Maximum side length',
        unit: 'pixel',
        minimum: 16,
        maximum: 16384,
        default: 2048,
        visibleWhen: { mode: ['lossy'] },
      },
      quality: {
        type: 'integer',
        title: 'Quality',
        minimum: 1,
        maximum: 100,
        default: 85,
        visibleWhen: { mode: ['lossy'] },
      },
    },
  },
}

const filterPlugin: TaskPluginOption = {
  key: 'request-filter',
  name: 'Request filter',
  models: [],
  task: false,
  provider: false,
  transform: true,
  configSchema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        title: 'Keywords',
        format: 'textarea',
        maxLength: 24,
        examples: ['spam\nscam'],
      },
      blocked: {
        type: 'string',
        title: 'Keyword list',
        format: 'keywords',
        maxLength: 1048576,
      },
      rules: {
        type: 'array',
        title: 'Rules',
        default: [],
        maxItems: 2,
        items: {
          type: 'object',
          title: 'Rule',
          required: ['pattern'],
          properties: {
            pattern: { type: 'string', title: 'Pattern', maxLength: 1024 },
            type: {
              type: 'string',
              title: 'Match type',
              enum: ['keyword', 'regex'],
              enumTitles: ['Keyword', 'Regular expression'],
              default: 'keyword',
            },
            id: { type: 'string', title: 'Rule ID', maxLength: 64 },
          },
        },
      },
    },
  },
}

const moderationPlugin: TaskPluginOption = {
  key: 'content-moderation',
  name: 'Content moderation',
  models: [],
  task: false,
  provider: false,
  transform: true,
  configSchema: {
    type: 'object',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        title: 'Moderation endpoint',
        format: 'url',
        default: 'https://api.openai.com/v1/moderations',
      },
      apiKey: { type: 'string', title: 'API key', format: 'password' },
    },
  },
}

beforeEach(() => {
  // jsdom cannot draw the sample image of the try panel.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function openEditor(pluginName: string) {
  const user = userEvent.setup()
  const onSave = vi.fn<(instance: RequestPluginInstance) => void>()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RequestPluginInstanceEditor
        open
        instance={null}
        plugins={[imagePlugin, filterPlugin, moderationPlugin]}
        instanceCounts={{}}
        groups={[]}
        models={[]}
        saving={false}
        onOpenChange={() => {}}
        onSave={onSave}
      />
    </QueryClientProvider>
  )
  const picker = await screen.findByRole('dialog', {
    name: 'Add request processing',
  })
  await user.click(
    within(picker).getByRole('button', { name: new RegExp(pluginName) })
  )
  const dialog = screen.getByRole('dialog')
  return { user, dialog, onSave }
}

async function chooseMode(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  mode: string
) {
  await user.click(within(dialog).getByRole('combobox', { name: 'Mode' }))
  await user.click(await screen.findByRole('option', { name: mode }))
}

test('a byte field shows its default in KB and saves bytes in the unit picked', async () => {
  const { user, dialog, onSave } = await openEditor('Image compress')
  const amount = within(dialog).getByRole('spinbutton', {
    name: 'Minimum image size',
  })
  const unit = within(dialog).getByRole('combobox', {
    name: 'Unit of Minimum image size',
  })
  expect(amount).toHaveValue(512)
  expect(unit).toHaveTextContent('KB')

  await user.click(unit)
  await user.click(await screen.findByRole('option', { name: 'MB' }))
  fireEvent.change(amount, { target: { value: '2' } })
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave).toHaveBeenCalledOnce()
  expect(onSave.mock.calls[0][0].config.minBytes).toBe(2000000)
})

test('fields shown only for another mode stay hidden until that mode is chosen and keep their values', async () => {
  const { user, dialog, onSave } = await openEditor('Image compress')
  expect(
    within(dialog).queryByRole('spinbutton', { name: 'Maximum side length' })
  ).toBeNull()

  await chooseMode(user, dialog, 'Lossy')
  const maxSide = within(dialog).getByRole('spinbutton', {
    name: 'Maximum side length',
  })
  expect(maxSide).toHaveValue(2048)
  expect(within(dialog).getByText('px')).toBeVisible()
  fireEvent.change(maxSide, { target: { value: '1024' } })
  await chooseMode(user, dialog, 'Lossless')
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0][0].config).toMatchObject({
    mode: 'lossless',
    maxSide: 1024,
  })
})

test('a whole number with a range of at most 100 is picked with a slider that follows the typed number', async () => {
  const { user, dialog } = await openEditor('Image compress')
  await chooseMode(user, dialog, 'Lossy')

  // Base UI keeps the thumb invisible until it can measure the track, which
  // jsdom never lets it do, so the slider is found through its label.
  const slider = within(dialog).getByLabelText('Quality', {
    selector: 'input[type=range]',
  })
  expect(slider).toHaveAttribute('aria-valuenow', '85')
  fireEvent.change(
    within(dialog).getByRole('spinbutton', { name: 'Quality' }),
    {
      target: { value: '60' },
    }
  )

  expect(slider).toHaveAttribute('aria-valuenow', '60')
})

test('an out-of-range number shows its error while typing and blocks the save', async () => {
  const { user, dialog, onSave } = await openEditor('Image compress')
  await chooseMode(user, dialog, 'Lossy')
  expect(
    within(dialog).getByText('Allowed range: 16 px to 16,384 px')
  ).toBeVisible()

  const maxSide = within(dialog).getByRole('spinbutton', {
    name: 'Maximum side length',
  })
  fireEvent.change(maxSide, { target: { value: '99999' } })

  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Enter at most 16384'
  )
  expect(maxSide).toHaveAttribute('aria-invalid', 'true')
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(onSave).not.toHaveBeenCalled()
})

test('rules are edited one row each and saved in the order shown', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  expect(within(dialog).getByText('None added yet')).toBeVisible()

  await user.click(within(dialog).getByRole('button', { name: 'Add Rule' }))
  await user.click(within(dialog).getByRole('button', { name: 'Add Rule' }))
  const first = within(dialog).getByRole('group', { name: 'Rule 1' })
  const second = within(dialog).getByRole('group', { name: 'Rule 2' })
  fireEvent.change(within(first).getByRole('textbox', { name: 'Pattern' }), {
    target: { value: 'alpha' },
  })
  fireEvent.change(within(second).getByRole('textbox', { name: 'Pattern' }), {
    target: { value: 'beta' },
  })
  fireEvent.change(within(second).getByRole('textbox', { name: 'Rule ID' }), {
    target: { value: 'b' },
  })
  await user.click(
    within(dialog).getByRole('button', { name: 'Move Rule 2 up' })
  )
  expect(
    within(dialog).getByRole('button', { name: 'Add Rule' })
  ).toBeDisabled()
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0][0].config.rules).toEqual([
    { pattern: 'beta', type: 'keyword', id: 'b' },
    { pattern: 'alpha', type: 'keyword' },
  ])
})

test('deleting a rule row leaves it out of the saved rules', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  await user.click(within(dialog).getByRole('button', { name: 'Add Rule' }))
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Pattern' }), {
    target: { value: 'alpha' },
  })

  await user.click(
    within(dialog).getByRole('button', { name: 'Delete Rule 1' })
  )
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0][0].config.rules).toEqual([])
})

test('a required rule field left empty is marked on its row once a save is tried', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  await user.click(within(dialog).getByRole('button', { name: 'Add Rule' }))
  expect(within(dialog).queryByRole('alert')).toBeNull()

  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  const row = within(dialog).getByRole('group', { name: 'Rule 1' })
  expect(within(row).getByRole('alert')).toHaveTextContent(
    'This field is required'
  )
  expect(within(row).getByRole('textbox', { name: 'Pattern' })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  expect(onSave).not.toHaveBeenCalled()
})

test('an address without http:// or https:// shows its error and blocks the save', async () => {
  const { user, dialog, onSave } = await openEditor('Content moderation')
  const url = within(dialog).getByRole('textbox', {
    name: 'Moderation endpoint',
  })
  fireEvent.change(url, { target: { value: 'api.openai.com/v1/moderations' } })

  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Enter a full address starting with http:// or https://'
  )
  expect(url).toHaveAttribute('aria-invalid', 'true')
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(onSave).not.toHaveBeenCalled()
})

test('a key field hides what is typed until the toggle shows it', async () => {
  const { user, dialog } = await openEditor('Content moderation')
  const key = within(dialog).getByLabelText('API key')
  expect(key).toHaveAttribute('type', 'password')

  await user.click(
    within(dialog).getByRole('button', { name: 'Show password' })
  )
  expect(key).toHaveAttribute('type', 'text')
})

test('a plugin that may be skipped says so instead of asking whether failures refuse requests', async () => {
  const { dialog } = await openEditor('Image compress')

  expect(within(dialog).getByText('Skipped when it fails')).toBeVisible()
  expect(within(dialog).queryByRole('switch', { name: 'Required' })).toBeNull()
})

test('a multi-line text shows its example as the placeholder, counts the lines that hold something and saves the text as typed', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  const keywords = within(dialog).getByRole('textbox', { name: 'Keywords' })
  expect(keywords.tagName).toBe('TEXTAREA')
  expect(keywords).toHaveAttribute('placeholder', 'spam\nscam')
  expect(within(dialog).queryByText(/^Lines:/)).toBeNull()

  fireEvent.change(keywords, { target: { value: 'alpha\n\n   \nbeta\n' } })
  expect(within(dialog).getByText('Lines: 2')).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0][0].config.keywords).toBe('alpha\n\n   \nbeta\n')
})

test('a multi-line text over its length limit shows its error while typing and blocks the save', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  const keywords = within(dialog).getByRole('textbox', { name: 'Keywords' })

  // 25 characters, one of them outside the basic plane.
  fireEvent.change(keywords, {
    target: { value: 'alpha\nbeta\ngamma\ndelta\n😀😀' },
  })

  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Enter at most 24 characters'
  )
  expect(keywords).toHaveAttribute('aria-invalid', 'true')
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(onSave).not.toHaveBeenCalled()
})

test('a multi-line text at its length limit in characters saves even when emoji make it longer in code units', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  const value = 'alpha\nbeta\ngamma\ndelta😀😀'

  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Keywords' }), {
    target: { value },
  })
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0][0].config.keywords).toBe(value)
})

test('a keyword list is edited like a multi-line text and saved as typed', async () => {
  const { user, dialog, onSave } = await openEditor('Request filter')
  const list = within(dialog).getByRole('textbox', { name: 'Keyword list' })
  expect(list.tagName).toBe('TEXTAREA')

  fireEvent.change(list, { target: { value: 'spam\n\nscam' } })
  expect(within(dialog).getByText('Lines: 2')).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(onSave.mock.calls[0][0].config.blocked).toBe('spam\n\nscam')
})
