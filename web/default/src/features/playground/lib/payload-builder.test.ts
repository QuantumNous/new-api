import { describe, expect, test } from 'bun:test'
import { buildChatCompletionPayload } from './payload-builder'
import { createUserMessage } from './message-utils'

const config = {
  model: 'gpt-4o',
  group: 'default',
  temperature: 0.7,
  top_p: 1,
  max_tokens: 100,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  stream: true,
}

const parameterEnabled = {
  temperature: false,
  top_p: false,
  max_tokens: false,
  frequency_penalty: false,
  presence_penalty: false,
  seed: false,
}

describe('buildChatCompletionPayload attachments', () => {
  test('passes normalized attachment content into the chat payload', () => {
    const payload = buildChatCompletionPayload(
      [
        createUserMessage('summarize', [
          {
            kind: 'text',
            filename: 'report.csv',
            mediaType: 'text/csv',
            text: 'name,total\nAda,4',
          },
        ]),
      ],
      config,
      parameterEnabled
    )

    expect(payload.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'summarize' },
          {
            type: 'text',
            text: '[Attached file: report.csv]\nname,total\nAda,4',
          },
        ],
      },
    ])
  })
})
