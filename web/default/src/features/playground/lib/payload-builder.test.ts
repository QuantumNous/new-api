import { describe, expect, test } from 'bun:test'
import { createUserMessage } from './message-utils'
import { buildChatCompletionPayload } from './payload-builder'

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

describe('buildChatCompletionPayload hidden quick-start guidance', () => {
  test('adds Flatkey onboarding guidance as a hidden system message', () => {
    const payload = buildChatCompletionPayload(
      [createUserMessage('How do I try flatkey?')],
      { ...config, model: 'gpt-5.5' },
      parameterEnabled
    )

    expect(payload.messages[0]).toMatchObject({ role: 'system' })
    expect(payload.messages[0]?.content).toContain('/quickstart')
    expect(payload.messages[1]).toEqual({
      role: 'user',
      content: 'How do I try flatkey?',
    })
  })

  test('does not expose or inject the internal guidance for unrelated prompts', () => {
    const message = createUserMessage('Write a quicksort in Python')
    const payload = buildChatCompletionPayload(
      [message],
      { ...config, model: 'gpt-5.5' },
      parameterEnabled
    )

    expect(payload.messages).toEqual([
      { role: 'user', content: 'Write a quicksort in Python' },
    ])
    expect(message.versions[0]?.content).toBe('Write a quicksort in Python')
  })

  test('only adds onboarding guidance when the latest user prompt asks to try Flatkey', () => {
    const payload = buildChatCompletionPayload(
      [
        createUserMessage('How do I try flatkey?'),
        {
          key: 'assistant-1',
          from: 'assistant',
          versions: [{ id: 'assistant-version-1', content: 'Here is how.' }],
        },
        createUserMessage('Write a quicksort in Python'),
      ],
      { ...config, model: 'gpt-5.5' },
      parameterEnabled
    )

    expect(payload.messages).toEqual([
      { role: 'user', content: 'How do I try flatkey?' },
      { role: 'assistant', content: 'Here is how.' },
      { role: 'user', content: 'Write a quicksort in Python' },
    ])
  })
})
