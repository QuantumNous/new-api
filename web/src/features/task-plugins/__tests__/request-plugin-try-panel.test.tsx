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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { TaskPluginOption } from '@/features/channels/api'
import { api } from '@/lib/api'

import { RequestPluginTryPanel } from '../components/request-plugin-try-panel'
import type { RequestPluginDryRunResult, RequestPluginInstance } from '../types'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const SAMPLE_TEXT =
  'Would this photo work as a phone wallpaper? Email the answer to alex@example.com, or call +14155550123 if anything is unclear.'
const SAMPLE_REPLY =
  'Yes, the soft colors and wide frame suit a phone wallpaper. I sent the full answer to alex@example.com; call +14155550123 if you would like a different crop.'

const plugin: TaskPluginOption = {
  key: 'request-redact',
  name: 'Request redact',
  models: [],
  task: false,
  provider: false,
  transform: true,
}

const instance: RequestPluginInstance = {
  id: '',
  name: 'Redact',
  plugin: 'request-redact',
  enabled: true,
  global: true,
  groups: [],
  models: [],
  config: { types: ['email', 'phone'] },
}

const replyPlugin: TaskPluginOption = {
  ...plugin,
  transform_hooks: ['ingress', 'reply'],
}

let client: QueryClient

beforeEach(() => {
  // jsdom draws nothing, so the sample request goes without its image.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(api, 'get').mockRejectedValue(new Error('no plugin icon'))
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

function result(
  overrides: Partial<RequestPluginDryRunResult>
): RequestPluginDryRunResult {
  return {
    rejected: null,
    failed: null,
    steps: [
      {
        instance: 'try',
        name: 'Redact',
        plugin: 'request-redact',
        stage: 'ingress',
        action: 'continue',
        effects: 1,
        duration_ms: 4,
      },
    ],
    body: {},
    record: [],
    ...overrides,
  }
}

function renderPanel(
  dryRun: RequestPluginDryRunResult,
  edited: RequestPluginInstance | null = instance,
  tried: TaskPluginOption = plugin
) {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: dryRun } })
  const view = (next: RequestPluginInstance | null) => (
    <QueryClientProvider client={client}>
      <RequestPluginTryPanel plugin={tried} instance={next} />
    </QueryClientProvider>
  )
  const { rerender } = render(view(edited))
  const panel = screen.getByRole('complementary', { name: 'Try it' })
  return {
    post,
    panel,
    user: userEvent.setup(),
    rerender: (next: RequestPluginInstance | null) => rerender(view(next)),
  }
}

test('running the sample sends the settings being edited and marks the replaced words', async () => {
  const redacted =
    'Would this photo work as a phone wallpaper? Email the answer to [EMAIL], or call [PHONE] if anything is unclear.'
  const { post, panel, user, rerender } = renderPanel(
    result({
      body: {
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'user', content: [{ type: 'text', text: redacted }] },
        ],
      },
      record: [
        {
          plugin: 'request-redact',
          stage: 'ingress',
          changes: [
            {
              op: 'replace',
              path: 'messages[0].content',
              type: 'string',
              length: redacted.length,
            },
          ],
          findings: [
            { category: 'email', count: 1 },
            { category: 'phone', count: 1 },
          ],
        },
      ],
    })
  )
  expect(within(panel).getByText(SAMPLE_TEXT)).toBeVisible()

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(
    await within(panel).findByText('alex@example.com', { selector: 'mark' })
  ).toBeVisible()
  expect(post).toHaveBeenCalledWith(
    '/api/request_plugin/dry_run',
    {
      format: 'openai',
      path: '/v1/chat/completions',
      model: 'gpt-4.1-mini',
      body: {
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'user', content: [{ type: 'text', text: SAMPLE_TEXT }] },
        ],
      },
      instance,
    },
    expect.anything()
  )
  expect(post.mock.calls[0][1]).not.toHaveProperty('reply', expect.anything())
  expect(
    within(panel)
      .getAllByRole('mark')
      .map((mark) => mark.textContent)
  ).toEqual(['alex@example.com', '+14155550123', '[EMAIL]', '[PHONE]'])
  expect(within(panel).getByText('What the usage log shows')).toBeVisible()
  expect(within(panel).getByText('Took 4 ms')).toBeVisible()
  expect(
    within(panel).queryByText('The settings changed since this run.')
  ).toBeNull()

  rerender({ ...instance, config: { types: ['email'] } })
  expect(
    within(panel).getByText('The settings changed since this run.')
  ).toBeVisible()
})

test('a refused request shows the refusal instead of the changes', async () => {
  const { panel, user } = renderPanel(
    result({
      rejected: {
        code: 'blocked.keyword',
        message: 'Contains a blocked word',
        instance: 'try',
      },
      record: [
        {
          plugin: 'request-redact',
          stage: 'ingress',
          rejected: { code: 'blocked.keyword' },
        },
      ],
    })
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(
    await within(panel).findByText('This request would be refused')
  ).toBeVisible()
  expect(within(panel).getByText('Contains a blocked word')).toBeVisible()
  expect(within(panel).queryByText('Original text')).toBeNull()
})

test('a run that changes nothing says the request goes as it is', async () => {
  const { panel, user } = renderPanel(
    result({
      body: { messages: [{ role: 'user', content: SAMPLE_TEXT }] },
      record: [],
    })
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(
    await within(panel).findByText('No changes. The request is sent as it is.')
  ).toBeVisible()
})

test('a smaller image shows both sizes and how much was saved', async () => {
  const { panel, user } = renderPanel(
    result({
      record: [
        {
          plugin: 'image-compress',
          stage: 'outbound',
          media: [
            {
              index: 0,
              from: { mime: 'image/png', bytes: 688537 },
              to: { mime: 'image/webp', bytes: 275546 },
              lossless: true,
            },
          ],
        },
      ],
    })
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(await within(panel).findByText('Original image')).toBeVisible()
  expect(within(panel).getByText('−60%')).toBeVisible()
  expect(within(panel).getByText(/^WEBP/)).toBeVisible()
})

test('a pasted request runs in the format picked and only its rewritten text is compared', async () => {
  const pasted = (text: string, image: string) => ({
    model: 'claude-x',
    max_tokens: 8,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: image },
          },
        ],
      },
    ],
  })
  const { post, panel, user } = renderPanel(
    result({ body: pasted('Call [PHONE]', 'BBBB') })
  )

  await user.click(within(panel).getByRole('tab', { name: 'Paste a request' }))
  await user.click(
    within(panel).getByRole('combobox', { name: 'Request format' })
  )
  await user.click(
    await screen.findByRole('option', { name: 'Claude Messages' })
  )
  const body = within(panel).getByRole('textbox', { name: 'Request body' })
  fireEvent.input(body, { target: { value: '[1]' } })
  await user.click(within(panel).getByRole('button', { name: 'Run' }))
  expect(
    within(panel).getByText('Request body must be a JSON object.')
  ).toBeVisible()
  expect(post).not.toHaveBeenCalled()

  fireEvent.input(body, {
    target: { value: JSON.stringify(pasted('Call +14155550123', 'AAAA')) },
  })
  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(post).toHaveBeenCalledWith(
    '/api/request_plugin/dry_run',
    expect.objectContaining({
      format: 'claude',
      path: '/v1/messages',
      model: 'claude-x',
      instance,
    }),
    expect.anything()
  )
  expect(await within(panel).findByText('Original text')).toBeVisible()
  expect(
    within(panel)
      .getAllByRole('mark')
      .map((mark) => mark.textContent)
  ).toEqual(['+14155550123', '[PHONE]'])
})

test('a plugin skipped after it fails says so with its error, not that nothing changed', async () => {
  const { panel, user } = renderPanel(
    result({
      steps: [
        {
          instance: 'try',
          name: 'Redact',
          plugin: 'request-redact',
          stage: 'outbound',
          action: 'fail',
          effects: 0,
          duration_ms: 4,
          error: 'TypeError: rules is not iterable',
        },
      ],
    }),
    instance,
    { ...plugin, optional: true }
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(
    await within(panel).findByText(
      'The plugin failed, so the request goes on without its changes'
    )
  ).toBeVisible()
  expect(
    within(panel).getByText('TypeError: rules is not iterable')
  ).toBeVisible()
  expect(
    within(panel).queryByText('No changes. The request is sent as it is.')
  ).toBeNull()
})

test('settings with problems cannot be run until they are fixed', () => {
  const { panel } = renderPanel(result({}), null)

  expect(within(panel).getByRole('button', { name: 'Run' })).toBeDisabled()
  expect(
    within(panel).getByText('Fix the settings first, then run.')
  ).toBeVisible()
})

test("a plugin's own samples show by name, and the one picked runs in its format", async () => {
  const { post, panel, user } = renderPanel(result({}), instance, {
    ...plugin,
    samples: [
      {
        name: { en: 'Support chat', zh: '客服对话' },
        lang: 'en',
        format: 'openai',
        body: {
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'My card is 4111 1111 1111 1111' },
          ],
        },
      },
      {
        name: { en: 'Gemini note' },
        lang: 'en',
        format: 'gemini',
        body: {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Call me on 555-0100' }, '[sample-image]'],
            },
          ],
        },
      },
      {
        name: { zh: '中文示例' },
        lang: 'zh',
        format: 'openai',
        body: { messages: [{ role: 'user', content: '我的手机号' }] },
      },
    ],
  })
  const samples = within(panel).getByRole('group', { name: 'Samples' })

  expect(
    within(samples)
      .getAllByRole('button')
      .map((chip) => chip.textContent)
  ).toEqual(['Support chat', 'Gemini note'])
  expect(
    within(panel).getByText('My card is 4111 1111 1111 1111')
  ).toBeVisible()
  expect(within(panel).queryByText(SAMPLE_TEXT)).toBeNull()

  await user.click(within(samples).getByRole('button', { name: 'Gemini note' }))
  expect(within(panel).getByText('Call me on 555-0100')).toBeVisible()
  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  // jsdom draws no image, so the placeholder is left out.
  expect(post).toHaveBeenCalledWith(
    '/api/request_plugin/dry_run',
    {
      format: 'gemini',
      path: '/v1beta/models/gemini-2.5-flash:generateContent',
      model: 'gemini-2.5-flash',
      body: {
        contents: [{ role: 'user', parts: [{ text: 'Call me on 555-0100' }] }],
      },
      instance,
    },
    expect.anything()
  )
})

test('a plugin that checks replies sends the sample reply and shows the masked parts of the answer', async () => {
  const masked =
    'Yes, the soft colors and wide frame suit a phone wallpaper. I sent the full answer to ***; call *** if you would like a different crop.'
  const { post, panel, user } = renderPanel(
    result({
      body: {
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'user', content: [{ type: 'text', text: SAMPLE_TEXT }] },
        ],
      },
      reply: { text: masked, stopped: null },
      record: [{ plugin: 'request-redact', stage: 'reply', masked: 2 }],
    }),
    instance,
    replyPlugin
  )
  expect(within(panel).getByText('Sample reply')).toBeVisible()
  expect(within(panel).getByText(SAMPLE_REPLY)).toBeVisible()

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(await within(panel).findByText('Sent to the client')).toBeVisible()
  expect(post.mock.calls[0][1]).toMatchObject({ reply: SAMPLE_REPLY })
  expect(within(panel).getByText('Answer from the model')).toBeVisible()
  expect(
    within(panel)
      .getAllByRole('mark')
      .map((mark) => mark.textContent)
  ).toEqual(['alex@example.com', '+14155550123', '***', '***'])
  expect(within(panel).getByText('Reply check')).toBeVisible()
  expect(within(panel).queryByText(/^No changes/)).toBeNull()
})

test('a reply the plugin stops shows the stop with its message and code', async () => {
  const { panel, user } = renderPanel(
    result({
      reply: {
        text: '',
        stopped: {
          instance: 'try',
          code: 'reply.blocked',
          message: 'The answer mentions a blocked topic',
        },
      },
      record: [
        {
          plugin: 'request-redact',
          stage: 'reply',
          rejected: { code: 'reply.blocked' },
        },
      ],
    }),
    instance,
    replyPlugin
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(
    await within(panel).findByText('This reply would be stopped')
  ).toBeVisible()
  expect(
    within(panel).getByText('The answer mentions a blocked topic')
  ).toBeVisible()
  expect(within(panel).getByText('reply.blocked')).toBeVisible()
  expect(within(panel).queryByText('Sent to the client')).toBeNull()
  expect(within(panel).queryByText(/^No changes/)).toBeNull()
})

test('an unchanged request and reply say both go through as they are', async () => {
  const { panel, user } = renderPanel(
    result({ reply: { text: SAMPLE_REPLY, stopped: null } }),
    instance,
    replyPlugin
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  expect(
    await within(panel).findByText(
      'No changes. The request and the reply go through as they are.'
    )
  ).toBeVisible()
})

test('a pasted request sends the reply typed beside it, and none when it is left empty', async () => {
  const { post, panel, user } = renderPanel(result({}), instance, replyPlugin)

  await user.click(within(panel).getByRole('tab', { name: 'Paste a request' }))
  await user.click(within(panel).getByRole('button', { name: 'Run' }))
  expect(post.mock.calls[0][1]).not.toHaveProperty('reply', expect.anything())

  await user.type(
    within(panel).getByRole('textbox', { name: 'Reply to check (optional)' }),
    'Reach me at bo@example.com'
  )
  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(post.mock.calls[1][1]).toMatchObject({
    format: 'openai',
    reply: 'Reach me at bo@example.com',
  })
})

test('a plugin without a reply check offers no sample reply', () => {
  const { panel } = renderPanel(result({}))

  expect(within(panel).queryByText('Sample reply')).toBeNull()
})

test('an effort a plugin sets shows next to the effort the request had', async () => {
  const { panel, user } = renderPanel(
    result({
      reasoning_effort_before: '',
      reasoning_effort: 'xhigh',
      record: [
        {
          plugin: 'auto-reasoning',
          stage: 'request',
          reasoning_effort: 'xhigh',
        },
      ],
    })
  )

  await user.click(within(panel).getByRole('button', { name: 'Run' }))

  const effort = await within(panel).findByRole('group', {
    name: 'Reasoning Effort',
  })
  expect(effort).toHaveTextContent('Not set')
  expect(effort).toHaveTextContent('Extra high')
})
