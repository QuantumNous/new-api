/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../constants'
import type { Message } from '../../types'
import {
  MAX_CHAT_PAYLOAD_BYTES,
  buildChatCompletionPayload,
  VISUAL_OUTPUT_SYSTEM_PROMPT,
  isChatCompletionPayloadTooLarge,
} from './payload-builder'

function userMessage(content: string, key = content): Message {
  return {
    key,
    from: 'user',
    versions: [{ id: `${key}-v`, content }],
    status: 'complete',
  }
}

function assistantMessage(content: string, key = content): Message {
  return {
    key,
    from: 'assistant',
    versions: [{ id: `${key}-v`, content }],
    status: 'complete',
  }
}

describe('buildChatCompletionPayload', () => {
  it('does not emit legacy search controls in ordinary chat payloads', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('latest news')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload).not.toHaveProperty('managed_tool_run_id')
    expect(payload).not.toHaveProperty('web_search')
    expect(payload).not.toHaveProperty('max_tool_loops')
  })
  it('omits whitespace-only system prompts', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hello')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { systemPrompt: '   \n\t  ' }
    )
    expect(payload.messages).toEqual([{ role: 'user', content: 'hello' }])
  })

  it('prepends a trimmed system prompt before history', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hello'), assistantMessage('hi')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { systemPrompt: '  You are helpful.  ', carryHistory: true }
    )
    expect(payload.messages[0]).toEqual({
      role: 'system',
      content: 'You are helpful.',
    })
    expect(payload.messages.slice(1)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ])
  })

  it('keeps only the last user turn when carryHistory is false', () => {
    const payload = buildChatCompletionPayload(
      [
        userMessage('first', 'u1'),
        assistantMessage('reply', 'a1'),
        userMessage('second', 'u2'),
      ],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { carryHistory: false, systemPrompt: 'persona' }
    )
    expect(payload.messages).toEqual([
      { role: 'system', content: 'persona' },
      { role: 'user', content: 'second' },
    ])
  })

  it('returns only system when history is empty and system is set', () => {
    const payload = buildChatCompletionPayload(
      [],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { systemPrompt: 'solo', carryHistory: false }
    )
    expect(payload.messages).toEqual([{ role: 'system', content: 'solo' }])
  })

  it('returns empty messages when history is empty and no system prompt', () => {
    const payload = buildChatCompletionPayload(
      [],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { carryHistory: false }
    )
    expect(payload.messages).toEqual([])
  })

  it('appends the visual-output capability prompt when enabled', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hi')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { systemPrompt: 'persona', visualOutput: true }
    )
    expect(payload.messages[0]).toEqual({
      role: 'system',
      content: `persona\n\n${VISUAL_OUTPUT_SYSTEM_PROMPT}`,
    })
  })

  it('injects the visual-output prompt alone without a persona', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hi')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { visualOutput: true }
    )
    expect(payload.messages[0]).toEqual({
      role: 'system',
      content: VISUAL_OUTPUT_SYSTEM_PROMPT,
    })
  })

  it('omits the visual-output prompt when disabled', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hi')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { systemPrompt: 'persona', visualOutput: false }
    )
    expect(payload.messages[0]).toEqual({
      role: 'system',
      content: 'persona',
    })
  })

  it('clamps oversized system prompts before send', () => {
    const huge = 'x'.repeat(12_000)
    const payload = buildChatCompletionPayload(
      [userMessage('hi')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED,
      { systemPrompt: huge }
    )
    expect(payload.messages[0]?.role).toBe('system')
    expect(String(payload.messages[0]?.content).length).toBe(8000)
  })

  it('requests stream usage only for streaming payloads', () => {
    const streaming = buildChatCompletionPayload(
      [userMessage('hello')],
      { ...DEFAULT_CONFIG, stream: true },
      DEFAULT_PARAMETER_ENABLED
    )
    expect(streaming.stream_options).toEqual({ include_usage: true })

    const nonStreaming = buildChatCompletionPayload(
      [userMessage('hello')],
      { ...DEFAULT_CONFIG, stream: false },
      DEFAULT_PARAMETER_ENABLED
    )
    expect(nonStreaming).not.toHaveProperty('stream_options')
  })

  it('formats image and parsed PDF attachments as image_url plus text parts', () => {
    const message = userMessage('Compare these files')
    message.attachments = [
      {
        id: 'image-1',
        name: 'chart.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,aW1hZ2U=',
        kind: 'image',
      },
      {
        id: 'pdf-1',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        kind: 'document',
        text: 'Revenue up 12%',
        assetId: 9,
      },
    ]

    const payload = buildChatCompletionPayload(
      [message],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Compare these files' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
          },
          {
            type: 'text',
            text: 'Attached document "report.pdf":\n\nRevenue up 12%',
          },
        ],
      },
    ])
  })

  it('sends extracted document text that has no binary payload', () => {
    const message = userMessage('Summarize')
    message.attachments = [
      {
        id: 'doc-1',
        name: 'plan.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        kind: 'document',
        text: 'Hire a CEO',
      },
    ]

    const payload = buildChatCompletionPayload(
      [message],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Summarize' },
          {
            type: 'text',
            text: 'Attached document "plan.docx":\n\nHire a CEO',
          },
        ],
      },
    ])
  })
})

describe('isChatCompletionPayloadTooLarge', () => {
  it('rejects payloads above the request byte limit', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('x'.repeat(MAX_CHAT_PAYLOAD_BYTES))],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(isChatCompletionPayloadTooLarge(payload)).toBe(true)
  })

  it('accepts normal payloads', () => {
    const payload = buildChatCompletionPayload(
      [userMessage('hello')],
      DEFAULT_CONFIG,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(isChatCompletionPayloadTooLarge(payload)).toBe(false)
  })
})
