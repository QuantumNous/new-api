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
import type { Message } from '../types'
import {
  applyChatCompletionResponse,
  runSingleChatRequest,
} from './use-chat-handler'

test('non-streaming requests stay busy until settled and reject reentry', async () => {
  const gate = { current: false }
  const busyStates: boolean[] = []
  let finishRequest: (() => void) | undefined
  let requestCalls = 0

  const first = runSingleChatRequest(
    gate,
    (busy) => busyStates.push(busy),
    () =>
      new Promise<void>((resolve) => {
        requestCalls += 1
        finishRequest = resolve
      })
  )
  const second = await runSingleChatRequest(
    gate,
    (busy) => busyStates.push(busy),
    async () => {
      requestCalls += 1
    }
  )

  expect(gate.current).toBe(true)
  expect(busyStates).toEqual([true])
  expect(second).toBe(false)
  expect(requestCalls).toBe(1)

  finishRequest?.()
  expect(await first).toBe(true)
  expect(gate.current).toBe(false)
  expect(busyStates).toEqual([true, false])
})

describe('applyChatCompletionResponse', () => {
  test('attaches response identity and token usage to the assistant message', () => {
    const loadingAssistant: Message = {
      key: 'assistant-message',
      from: 'assistant',
      versions: [{ id: 'assistant-version', content: '' }],
      status: 'loading',
    }

    const completed = applyChatCompletionResponse(loadingAssistant, {
      id: 'chatcmpl-request-1',
      object: 'chat.completion',
      created: 1,
      model: 'gpt-test',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'world',
            reasoning_content: 'thinking',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 5,
        total_tokens: 8,
      },
    })

    expect(completed.versions[0]?.content).toBe('world')
    expect(completed.status).toBe('complete')
    expect(completed.responseMetadata).toEqual({
      relayRequestId: 'chatcmpl-request-1',
      promptTokens: 3,
      completionTokens: 5,
      totalTokens: 8,
    })
  })
})
