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
import { describe, expect, test } from 'bun:test'
import type {
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundRecordPayload,
} from '../types'
import {
  buildPlaygroundRecordPayload,
  createActivePlaygroundTurn,
  drainPlaygroundOutbox,
  mergeRestoredMessages,
  removeDeliveredPlaygroundRecords,
  restorePlaygroundSession,
  type ActivePlaygroundTurn,
} from './playground-persistence'

const userMessage: Message = {
  key: 'user-message',
  from: 'user',
  versions: [{ id: 'user-version', content: 'hello' }],
}

const loadingAssistant: Message = {
  key: 'assistant-message',
  from: 'assistant',
  versions: [{ id: 'assistant-version', content: '' }],
  status: 'loading',
}

const completeAssistant: Message = {
  ...loadingAssistant,
  versions: [{ id: 'assistant-version', content: 'world' }],
  reasoning: { content: 'thinking', duration: 500 },
  status: 'complete',
}

const errorAssistant: Message = {
  ...loadingAssistant,
  versions: [{ id: 'assistant-version', content: 'rate limited' }],
  status: 'error',
  errorCode: 'rate_limit_exceeded',
}

const config: PlaygroundConfig = {
  model: 'gpt-test',
  group: 'plg',
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  stream: true,
}

const parameterEnabled: ParameterEnabled = {
  temperature: true,
  top_p: false,
  max_tokens: false,
  frequency_penalty: false,
  presence_penalty: false,
  seed: false,
}

function activeTurn(): ActivePlaygroundTurn {
  return {
    recordId: '550e8400-e29b-41d4-a716-446655440000',
    conversationId: '550e8400-e29b-41d4-a716-446655440001',
    assistantMessageKey: 'assistant-message',
    startedAt: 1000,
    request: {
      model: 'gpt-test',
      group: 'plg',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      temperature: 0.7,
    },
    userMessage,
  }
}

describe('Playground persistence payloads', () => {
  test('restores local attachment data omitted from the server snapshot', () => {
    const serverMessages: Message[] = [
      {
        ...userMessage,
        versions: [
          {
            ...userMessage.versions[0],
            attachments: [
              {
                kind: 'image',
                filename: 'photo.png',
                mediaType: 'image/png',
              },
            ],
          },
        ],
      },
    ]
    const localMessages: Message[] = [
      {
        ...userMessage,
        versions: [
          {
            ...userMessage.versions[0],
            attachments: [
              {
                kind: 'image',
                filename: 'photo.png',
                mediaType: 'image/png',
                url: 'data:image/png;base64,AA==',
              },
            ],
          },
        ],
      },
    ]

    const restored = mergeRestoredMessages(serverMessages, localMessages)

    expect(restored[0].versions[0].attachments).toEqual(
      localMessages[0].versions[0].attachments
    )
    expect(restored[0].versions[0].content).toBe('hello')
  })

  test('does not copy attachments across unrelated messages', () => {
    const serverMessages: Message[] = [userMessage]
    const localMessages: Message[] = [
      {
        ...userMessage,
        key: 'different-message',
        versions: [
          {
            ...userMessage.versions[0],
            attachments: [
              {
                kind: 'image',
                filename: 'photo.png',
                mediaType: 'image/png',
                url: 'data:image/png;base64,AA==',
              },
            ],
          },
        ],
      },
    ]

    expect(mergeRestoredMessages(serverMessages, localMessages)).toEqual(
      serverMessages
    )
  })

  test('captures the normalized relay request when a turn starts', () => {
    const active = createActivePlaygroundTurn(
      '550e8400-e29b-41d4-a716-446655440001',
      [userMessage, loadingAssistant],
      config,
      parameterEnabled,
      false,
      'assistant-message',
      1000
    )

    expect(active.startedAt).toBe(1000)
    expect(active.assistantMessageKey).toBe('assistant-message')
    expect(active.userMessage).toEqual(userMessage)
    expect(active.request).toEqual({
      model: 'gpt-test',
      group: 'plg',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      temperature: 0.7,
    })
    expect(active.recordId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  test('builds a complete terminal record', () => {
    const finalMessages = [
      userMessage,
      {
        ...completeAssistant,
        responseMetadata: {
          relayRequestId: 'chatcmpl-request-1',
          promptTokens: 3,
          completionTokens: 5,
          totalTokens: 8,
        },
      },
    ]
    const payload = buildPlaygroundRecordPayload(
      activeTurn(),
      finalMessages,
      false,
      2500
    )

    expect(payload.status).toBe('complete')
    expect(payload.input_text).toBe('hello')
    expect(payload.output_text).toBe('world')
    expect(payload.reasoning_content).toBe('thinking')
    expect(payload.latency_ms).toBe(1500)
    expect(payload.request_messages).toEqual([
      { role: 'user', content: 'hello' },
    ])
    expect(payload.parameters).toEqual({ stream: true, temperature: 0.7 })
    expect(payload.relay_request_id).toBe('chatcmpl-request-1')
    expect(payload.prompt_tokens).toBe(3)
    expect(payload.completion_tokens).toBe(5)
    expect(payload.total_tokens).toBe(8)
    expect(payload.messages_snapshot).toEqual(finalMessages)
  })

  test('removes embedded base64 media from every persisted record section', () => {
    const embeddedImage = 'data:image/png;base64,AA=='
    const remoteImage = 'https://cdn.example.com/photo.png'
    const userWithAttachments: Message = {
      ...userMessage,
      versions: [
        {
          ...userMessage.versions[0],
          attachments: [
            {
              kind: 'image',
              filename: 'photo.png',
              mediaType: 'image/png',
              url: embeddedImage,
            },
            {
              kind: 'image',
              filename: 'remote.png',
              mediaType: 'image/png',
              url: remoteImage,
            },
            {
              kind: 'text',
              filename: 'notes.txt',
              mediaType: 'text/plain',
              text: 'keep this text',
            },
          ],
        },
      ],
    }
    const active = {
      ...activeTurn(),
      userMessage: userWithAttachments,
      request: {
        ...activeTurn().request,
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: 'hello' },
              { type: 'image_url' as const, image_url: { url: embeddedImage } },
              {
                type: 'video_url' as const,
                video_url: { url: 'data:video/mp4;base64,AA==' },
              },
              { type: 'image_url' as const, image_url: { url: remoteImage } },
            ],
          },
        ],
      },
    }
    const assistantWithMedia: Message = {
      ...completeAssistant,
      versions: [
        {
          ...completeAssistant.versions[0],
          generatedMedia: [
            { type: 'image', url: embeddedImage },
            { type: 'image', url: remoteImage },
          ],
        },
      ],
    }

    const payload = buildPlaygroundRecordPayload(
      active,
      [userWithAttachments, assistantWithMedia],
      false,
      2500
    )

    expect(payload.user_message.versions[0]?.attachments).toEqual([
      {
        kind: 'image',
        filename: 'photo.png',
        mediaType: 'image/png',
      },
      {
        kind: 'image',
        filename: 'remote.png',
        mediaType: 'image/png',
        url: remoteImage,
      },
      {
        kind: 'text',
        filename: 'notes.txt',
        mediaType: 'text/plain',
        text: 'keep this text',
      },
    ])
    expect(payload.request_messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'image_url', image_url: { url: remoteImage } },
        ],
      },
    ])
    expect(payload.assistant_message.versions[0]?.generatedMedia).toEqual([
      { type: 'image', url: remoteImage },
    ])
    expect(JSON.stringify(payload)).not.toContain(embeddedImage)

    expect(userWithAttachments.versions[0]?.attachments?.[0]?.url).toBe(
      embeddedImage
    )
    expect(assistantWithMedia.versions[0]?.generatedMedia?.[0]?.url).toBe(
      embeddedImage
    )
  })

  test('binds the terminal payload to the assistant created for that turn', () => {
    const laterAssistant: Message = {
      key: 'assistant-later',
      from: 'assistant',
      versions: [{ id: 'later-version', content: 'wrong response' }],
      status: 'complete',
    }

    const payload = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant, laterAssistant],
      false,
      2500
    )

    expect(payload.assistant_message.key).toBe('assistant-message')
    expect(payload.output_text).toBe('world')
  })

  test('distinguishes a stopped turn from a completed UI message', () => {
    const payload = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant],
      true,
      2500
    )

    expect(payload.status).toBe('stopped')
  })

  test('assistant errors take precedence over an explicit stop', () => {
    const payload = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, errorAssistant],
      true,
      2500
    )

    expect(payload.status).toBe('error')
    expect(payload.error_code).toBe('rate_limit_exceeded')
    expect(payload.error_message).toBe('rate limited')
  })

  test('sanitizes records restored from an older outbox before saving', async () => {
    const embeddedImage = 'data:image/png;base64,AA=='
    const cleanRecord = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant],
      false,
      2500
    )
    const staleRecord = {
      ...cleanRecord,
      user_message: {
        ...cleanRecord.user_message,
        versions: [
          {
            ...cleanRecord.user_message.versions[0],
            attachments: [
              {
                kind: 'image' as const,
                filename: 'photo.png',
                mediaType: 'image/png',
                url: embeddedImage,
              },
            ],
          },
        ],
      },
    }
    let savedRecord: typeof staleRecord | undefined

    const remaining = await drainPlaygroundOutbox(
      [staleRecord],
      async (record) => {
        savedRecord = record as typeof staleRecord
      }
    )

    expect(remaining).toEqual([])
    expect(savedRecord?.user_message.versions[0]?.attachments).toEqual([
      {
        kind: 'image',
        filename: 'photo.png',
        mediaType: 'image/png',
      },
    ])
    expect(staleRecord.user_message.versions[0]?.attachments?.[0]?.url).toBe(
      embeddedImage
    )
  })

  test('removes legacy base64 fields from stale outbox records', async () => {
    const embeddedImage = 'data:image/png;base64,AA-_=='
    const staleRecord = {
      ...buildPlaygroundRecordPayload(
        activeTurn(),
        [userMessage, completeAssistant],
        false,
        2500
      ),
      parameters: {
        nested: {
          B64_JSON: embeddedImage,
          note: `before ${embeddedImage} after`,
        },
      },
    } as PlaygroundRecordPayload
    let savedRecord: PlaygroundRecordPayload | undefined

    await drainPlaygroundOutbox([staleRecord], async (record) => {
      savedRecord = record
    })

    expect(savedRecord?.parameters).toEqual({
      nested: {
        note: 'before [embedded media omitted] after',
      },
    })
    expect(JSON.stringify(savedRecord)).not.toContain('B64_JSON')
    expect(staleRecord.parameters).toEqual({
      nested: {
        B64_JSON: embeddedImage,
        note: `before ${embeddedImage} after`,
      },
    })
  })

  test('drains pending records FIFO and stops at the first failure', async () => {
    const first = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant],
      false,
      2500
    )
    const second = {
      ...first,
      record_id: '550e8400-e29b-41d4-a716-446655440002',
    }
    const calls: string[] = []

    const remaining = await drainPlaygroundOutbox(
      [first, second],
      async (record) => {
        calls.push(record.record_id)
        if (record.record_id === second.record_id) {
          throw new Error('offline')
        }
      }
    )

    expect(calls).toEqual([first.record_id, second.record_id])
    expect(remaining).toEqual([second])
  })

  test('does not restore server state while an outbox record still fails', async () => {
    const pending = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant],
      false,
      2500
    )
    let fetchedCurrent = false

    const result = await restorePlaygroundSession(
      [pending],
      async () => {
        throw new Error('offline')
      },
      async () => {
        fetchedCurrent = true
        return { conversation_id: pending.conversation_id, messages: [] }
      }
    )

    expect(fetchedCurrent).toBe(false)
    expect(result).toEqual({
      pendingRecords: [pending],
      shouldApplyCurrent: false,
    })
  })

  test('treats an explicit null server snapshot as restorable state', async () => {
    const result = await restorePlaygroundSession(
      [],
      async () => {},
      async () => null
    )

    expect(result).toEqual({
      pendingRecords: [],
      shouldApplyCurrent: true,
      current: null,
    })
  })

  test('retries a transient current snapshot read before applying server state', async () => {
    let attempts = 0
    const waitedAfterAttempts: number[] = []

    const result = await restorePlaygroundSession(
      [],
      async () => {},
      async () => {
        attempts += 1
        if (attempts < 3) throw new Error('temporary outage')
        return { conversation_id: 'conversation-a', messages: [userMessage] }
      },
      {
        retryCurrentAfter: async (attempt) => {
          waitedAfterAttempts.push(attempt)
        },
      }
    )

    expect(attempts).toBe(3)
    expect(waitedAfterAttempts).toEqual([1, 2])
    expect(result).toEqual({
      pendingRecords: [],
      shouldApplyCurrent: true,
      current: { conversation_id: 'conversation-a', messages: [userMessage] },
    })
  })

  test('keeps delivered records removed when all current snapshot retries fail', async () => {
    const pending = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant],
      false,
      2500
    )
    let currentAttempts = 0

    const result = await restorePlaygroundSession(
      [pending],
      async () => {},
      async () => {
        currentAttempts += 1
        throw new Error('temporary outage')
      },
      { retryCurrentAfter: async () => {} }
    )

    expect(currentAttempts).toBe(3)
    expect(result).toEqual({
      pendingRecords: [],
      shouldApplyCurrent: false,
    })
  })

  test('keeps a local-only media conversation instead of fetching stale server state', async () => {
    let fetchedCurrent = false

    const result = await restorePlaygroundSession(
      [],
      async () => {},
      async () => {
        fetchedCurrent = true
        return { conversation_id: 'server-conversation', messages: [] }
      },
      { preferLocal: true }
    )

    expect(fetchedCurrent).toBe(false)
    expect(result).toEqual({
      pendingRecords: [],
      shouldApplyCurrent: false,
    })
  })

  test('removes only delivered records from a queue changed during network I/O', () => {
    const first = buildPlaygroundRecordPayload(
      activeTurn(),
      [userMessage, completeAssistant],
      false,
      2500
    )
    const newlyQueued = {
      ...first,
      record_id: '550e8400-e29b-41d4-a716-446655440003',
    }

    expect(
      removeDeliveredPlaygroundRecords([first, newlyQueued], [first], [])
    ).toEqual([newlyQueued])
  })
})
