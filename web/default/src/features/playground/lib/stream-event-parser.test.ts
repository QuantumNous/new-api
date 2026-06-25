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
import { parseStreamMessageEvent } from './stream-event-parser'

describe('parseStreamMessageEvent', () => {
  test('detects OpenAI-style error payloads in SSE message events', () => {
    expect(
      parseStreamMessageEvent(
        JSON.stringify({
          error: {
            message: 'temperature and top_p cannot both be specified',
            code: 'invalid_request_error',
          },
        })
      )
    ).toEqual({
      type: 'error',
      message: 'temperature and top_p cannot both be specified',
      code: 'invalid_request_error',
    })
  })

  test('extracts reasoning and content deltas from chat chunks', () => {
    expect(
      parseStreamMessageEvent(
        JSON.stringify({
          choices: [
            {
              delta: {
                reasoning_content: 'think',
                content: 'answer',
              },
            },
          ],
        })
      )
    ).toEqual({
      type: 'delta',
      reasoning: 'think',
      content: 'answer',
    })
  })

  test('reports parse errors for invalid JSON', () => {
    expect(parseStreamMessageEvent('not-json')).toEqual({
      type: 'parse_error',
    })
  })
})
