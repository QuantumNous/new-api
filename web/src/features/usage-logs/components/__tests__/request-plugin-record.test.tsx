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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData, RequestPluginRecordEntry } from '../../types'
import { useCommonLogsColumns } from '../columns/common-logs-columns'
import { DetailsDialog } from '../dialogs/details-dialog'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterAll(() => vi.unstubAllGlobals())

const other: LogOtherData = {
  request_plugins: [
    {
      plugin: 'request-redact',
      name: { en: 'Request redaction', zh: '请求脱敏' },
      stage: 'ingress',
      notice: { en: 'Personal data was hidden.', zh: '个人信息已隐去。' },
      changes: [
        {
          op: 'replace',
          path: 'messages[1].content',
          type: 'string',
          length: 132,
        },
        { op: 'add', path: 'temperature', value: 0.5 },
        { op: 'remove', path: 'metadata' },
        { op: 'move', from: 'a.b', path: 'c' },
        { op: 'add', path: 'top_p', value: 0.9, overridden: true },
      ],
      more_changes: 2,
      headers: {
        set: ['x-foo', 'X-Region'],
        remove: ['x-bar'],
        overridden: ['x-region'],
      },
      reasoning_effort: 'high',
      media: [
        {
          index: 0,
          from: { mime: 'image/png', bytes: 1_200_000 },
          to: { mime: 'image/webp', bytes: 800_000 },
          lossless: true,
        },
      ],
      findings: [
        { category: 'email', count: 1 },
        { category: 'passport', count: 2 },
      ],
    },
    {
      plugin: 'request-filter',
      name: 'Request filter',
      stage: 'egress',
      rejected: { code: 'request_filtered' },
    },
    {
      plugin: 'content-moderation',
      name: 'Content moderation',
      stage: 'outbound',
      unchecked: true,
    },
    { truncated: 3 },
  ],
  admin_info: {
    request_plugins: [
      {
        instance: 'rp_aaaa1111',
        name: 'Hide personal data',
        plugin: 'request-redact',
        version: '1.0.0',
        stage: 'ingress',
        duration_ms: 4,
        error_class: 'timeout',
        findings: [{ rule: 'email-rule', category: 'email', count: 1 }],
      },
    ],
  },
}

function makeLog(logOther: LogOtherData = other): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1,
    type: 2,
    content: '',
    username: 'user',
    token_name: 'token',
    model_name: 'gpt-test',
    quota: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    use_time: 0,
    is_stream: false,
    channel: 1,
    channel_name: 'channel',
    token_id: 1,
    group: 'default',
    ip: '',
    other: JSON.stringify(logOther),
    request_id: 'req-1',
    upstream_request_id: '',
  }
}

const queryClients: QueryClient[] = []
afterEach(() => {
  for (const queryClient of queryClients) queryClient.clear()
  queryClients.length = 0
})

function withClient(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
  queryClients.push(queryClient)
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderDetails(isAdmin: boolean) {
  render(
    withClient(
      <DetailsDialog
        log={makeLog()}
        isAdmin={isAdmin}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    )
  )
}

function ModelCell(props: { other?: LogOtherData }) {
  const table = useReactTable({
    data: [makeLog(props.other)],
    columns: useCommonLogsColumns(false, false),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'model_name')
  if (!cell) throw new Error('The log list must have a model column')
  return <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>
}

describe('request processing in the log details', () => {
  test('each plugin shows its stage, notice, changes, headers, effort, media and findings', () => {
    renderDetails(false)

    expect(screen.getByText('Request redaction')).toBeInTheDocument()
    expect(screen.getByText('Before the request is read')).toBeInTheDocument()
    expect(screen.getByText('Personal data was hidden.')).toBeInTheDocument()
    expect(screen.getByText('Rewrite')).toBeInTheDocument()
    expect(screen.getByText('messages[1].content')).toBeInTheDocument()
    expect(screen.getByText('Text, 132 characters')).toBeInTheDocument()
    expect(screen.getByText('temperature')).toBeInTheDocument()
    expect(screen.getByText('0.5')).toBeInTheDocument()
    expect(screen.getByText('metadata')).toBeInTheDocument()
    expect(screen.getByText('a.b → c')).toBeInTheDocument()
    expect(screen.getByText('2 more changes')).toBeInTheDocument()
    expect(screen.getByText('x-foo')).toBeInTheDocument()
    expect(screen.getByText('x-bar')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(
      screen.getByText('Image 1: PNG 1.2 MB → WebP 800 KB (lossless)')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Email address × 1, passport × 2')
    ).toBeInTheDocument()
  })

  test('a refusal reads as blocked with its code, and a cut record says how much is left out', () => {
    renderDetails(false)

    expect(screen.getByText('Request filter')).toBeInTheDocument()
    expect(screen.getByText('Final check')).toBeInTheDocument()
    expect(
      screen.getByText('Blocked (code: request_filtered)')
    ).toBeInTheDocument()
    expect(screen.getByText('3 more steps are not shown')).toBeInTheDocument()
  })

  test('a change or header the channel setting replaced stays listed, muted and marked', () => {
    renderDetails(false)

    const change = screen.getByText('top_p')
    expect(change).toHaveClass('text-muted-foreground')
    expect(screen.getByText('0.9')).toHaveClass('text-muted-foreground')
    expect(change.parentElement).toHaveTextContent(
      'Replaced by the channel setting'
    )
    expect(screen.getByText('temperature')).not.toHaveClass(
      'text-muted-foreground'
    )
    expect(screen.getByText('temperature').parentElement).not.toHaveTextContent(
      'Replaced by the channel setting'
    )

    const header = screen.getByText('X-Region').parentElement
    expect(header).toHaveClass('text-muted-foreground')
    expect(header).toHaveTextContent('Replaced by the channel setting')
    expect(
      screen.getByText('x-foo').closest('.text-muted-foreground')
    ).toBeNull()
    expect(screen.getAllByText('Replaced by the channel setting')).toHaveLength(
      2
    )
  })

  test.each([
    [true, 'shown to admins'],
    [false, 'hidden from other users'],
  ])('the instance steps are %s', (isAdmin) => {
    renderDetails(isAdmin)

    const steps = screen.queryByText('Request processing steps')
    if (!isAdmin) {
      expect(steps).toBeNull()
      expect(screen.queryByText('Hide personal data (rp_aaaa1111)')).toBeNull()
      expect(screen.queryByText('timeout')).toBeNull()
      return
    }
    expect(steps).toBeInTheDocument()
    expect(
      screen.getByText('Hide personal data (rp_aaaa1111)')
    ).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
    expect(screen.getByText('4 ms')).toBeInTheDocument()
    expect(screen.getByText('timeout')).toBeInTheDocument()
    expect(screen.getByText('email-rule')).toBeInTheDocument()
  })
})

test('a processed request is marked in the log list and the mark names its plugins', async () => {
  render(withClient(<ModelCell />))

  const marker = screen.getByText('Processed')
  expect(marker).toBeVisible()
  await userEvent.hover(marker)

  expect(
    await screen.findByText(
      'Request processing: Request redaction, Request filter'
    )
  ).toBeInTheDocument()
})

test('a plugin that could not read the request shows as not checked in the details', () => {
  renderDetails(false)

  expect(screen.getByText('Content moderation')).toBeInTheDocument()
  expect(screen.getByText('Not checked')).toBeInTheDocument()
})

test('a request no plugin could read gets no processed mark in the log list', () => {
  render(
    withClient(
      <ModelCell
        other={{
          request_plugins: [
            {
              plugin: 'content-moderation',
              name: 'Content moderation',
              stage: 'ingress',
              unchecked: true,
            },
          ],
        }}
      />
    )
  )

  expect(screen.getByText('gpt-test')).toBeInTheDocument()
  expect(screen.queryByText('Processed')).toBeNull()
})

test('reply checks show their stage, the parts they masked, a stop with its code and an answer they could not read', () => {
  render(
    withClient(
      <DetailsDialog
        log={makeLog({
          request_plugins: [
            {
              plugin: 'request-redact',
              name: 'Reply redaction',
              stage: 'reply',
              masked: 3,
              findings: [{ category: 'email', count: 3 }],
            },
            {
              plugin: 'request-filter',
              name: 'Reply filter',
              stage: 'reply',
              rejected: { code: 'reply_blocked' },
            },
            {
              plugin: 'content-moderation',
              name: 'Reply moderation',
              stage: 'reply',
              unchecked: true,
            },
          ],
        })}
        isAdmin={false}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    )
  )

  expect(screen.getAllByText('Reply check')).toHaveLength(3)
  expect(screen.getByText('Masked parts').parentElement).toHaveTextContent(
    'Masked parts3'
  )
  expect(screen.getByText('Email address × 3')).toBeInTheDocument()
  expect(screen.getByText('Stopped (code: reply_blocked)')).toBeInTheDocument()
  expect(screen.queryByText('Blocked (code: reply_blocked)')).toBeNull()
  expect(screen.getByText('Not checked')).toBeInTheDocument()
})

test('a Realtime session shows its unchecked audio input once and a transcript stop as a stopped reply', () => {
  render(
    withClient(
      <DetailsDialog
        log={makeLog({
          request_plugins: [
            {
              plugin: 'request-filter',
              name: 'Request filter',
              stage: 'ingress',
              unchecked: true,
              audio: true,
            },
            {
              plugin: 'request-redact',
              name: 'Request redaction',
              stage: 'reply',
              rejected: { code: 'masked' },
            },
          ],
        })}
        isAdmin={false}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    )
  )

  expect(screen.getByText('Audio not checked')).toBeInTheDocument()
  expect(screen.queryByText('Not checked')).toBeNull()
  expect(screen.getByText('Stopped (code: masked)')).toBeInTheDocument()
})

function renderAttachments(
  attachments: NonNullable<RequestPluginRecordEntry['attachments']>,
  more?: number
) {
  render(
    withClient(
      <DetailsDialog
        log={makeLog({
          request_plugins: [
            {
              plugin: 'request-redact',
              name: 'Request redaction',
              stage: 'ingress',
              attachments,
              more_attachments: more,
            },
          ],
        })}
        isAdmin={false}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    )
  )
  const lines = screen.getByText('Attachments').nextElementSibling?.children
  if (!lines) throw new Error('The attachments must sit in one row')
  return [...lines].map((line) => line.textContent)
}

test('every attachment of a request is listed in order with how much of it was checked and why one was not', () => {
  const lines = renderAttachments(
    [
      { kind: 'document', mime: 'application/pdf', status: 'truncated' },
      { kind: 'image', mime: 'image/png', status: 'checked' },
      {
        kind: 'document',
        mime: 'text/plain',
        status: 'checked',
        rewritten: true,
      },
      { kind: 'other', mime: '', status: 'unchecked', reason: 'reference' },
      {
        kind: 'document',
        mime: 'application/pdf',
        status: 'unchecked',
        reason: 'no_text',
      },
      { kind: 'video', mime: 'video/mp4', status: 'unchecked', reason: 'busy' },
      {
        kind: 'document',
        mime: 'application/pdf',
        status: 'unchecked',
        reason: 'not_rewritable',
      },
      { kind: 'image', mime: 'image/jpeg', status: 'unchecked' },
    ],
    4
  )

  expect(lines).toEqual([
    'DocumentOnly the first part was checked',
    'ImageChecked',
    'DocumentCheckedContent rewritten',
    'FileNot checkedThe file is not in the request',
    'DocumentNot checkedNo text in the file',
    'VideoNot checkedServer busy',
    'DocumentNot checkedCannot be rewritten',
    'ImageNot checked',
    '4 more attachments',
  ])
  expect(screen.queryByText('application/pdf')).toBeNull()
})

test('a plugin that only lists the files it read shows just those, without numbering them', () => {
  const lines = renderAttachments([
    {
      kind: 'document',
      mime: 'text/plain',
      status: 'checked',
      rewritten: true,
    },
  ])

  expect(lines).toEqual(['DocumentCheckedContent rewritten'])
  expect(screen.queryByText(/Attachment \d/)).toBeNull()
})

test.each([
  [false, 'checked', 'gets no processed mark'],
  [true, 'rewritten', 'is marked processed'],
])(
  'a request whose plugin only read its attachments, one of them %s, %s',
  (rewritten) => {
    render(
      withClient(
        <ModelCell
          other={{
            request_plugins: [
              {
                plugin: 'request-redact',
                name: 'Request redaction',
                stage: 'ingress',
                attachments: [
                  {
                    kind: 'document',
                    mime: 'text/plain',
                    status: 'checked',
                    rewritten,
                  },
                  { kind: 'image', mime: 'image/png', status: 'unchecked' },
                ],
              },
            ],
          }}
        />
      )
    )

    expect(screen.getByText('gpt-test')).toBeInTheDocument()
    if (rewritten) expect(screen.getByText('Processed')).toBeVisible()
    else expect(screen.queryByText('Processed')).toBeNull()
  }
)
