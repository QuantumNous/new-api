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
import { describe, expect, test } from 'vitest'

import { parseStreamMessageUpdates } from '../streaming/stream-utils'

describe('parseStreamMessageUpdates sources', () => {
  test('emits sources for annotation-only chunks', () => {
    const updates = parseStreamMessageUpdates(
      JSON.stringify({
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            delta: {
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/news',
                    title: 'News',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      })
    )

    expect(updates).toEqual([
      {
        type: 'sources',
        sources: [{ href: 'https://example.com/news', title: 'News' }],
      },
    ])
  })

  test('emits both content and sources for combined chunks', () => {
    const updates = parseStreamMessageUpdates(
      JSON.stringify({
        choices: [
          {
            index: 0,
            delta: {
              content: 'See this link.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: { url: 'https://example.com/a' },
                },
                {
                  type: 'url_citation',
                  url_citation: { url: 'javascript:x' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      })
    )

    expect(updates).toEqual([
      { type: 'content', chunk: 'See this link.' },
      {
        type: 'sources',
        sources: [
          { href: 'https://example.com/a', title: 'https://example.com/a' },
        ],
      },
    ])
  })
})
