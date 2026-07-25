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
import { describe, expect, it } from 'vitest'

import type { Message } from '../types'
import {
  extractManagedSearchResult,
  updateManagedAssistant,
} from './managed-tools'

describe('updateManagedAssistant', () => {
  it('updates only the assistant belonging to the routed turn', () => {
    const messages = [
      { key: 'pending-a', from: 'assistant', versions: [], status: 'loading' },
      { key: 'pending-b', from: 'assistant', versions: [], status: 'loading' },
    ] as Message[]
    const result = updateManagedAssistant(messages, 'pending-a', {
      runId: 7,
      action: 'generate_image',
      status: 'completed',
    })

    expect(result[0].managedTool?.runId).toBe(7)
    expect(result[1]).toBe(messages[1])
  })

  it('sets search content and sources on only the routed assistant', () => {
    const messages = [
      {
        key: 'pending-a',
        from: 'assistant',
        versions: [{ id: 'a', content: '' }],
        status: 'loading',
      },
      {
        key: 'pending-b',
        from: 'assistant',
        versions: [{ id: 'b', content: '' }],
        status: 'loading',
      },
    ] as Message[]
    const sources = [{ href: 'https://example.com/', title: 'Example' }]
    const result = updateManagedAssistant(
      messages,
      'pending-a',
      { action: 'web_search', status: 'completed' },
      sources,
      'The answer'
    )

    expect(result[0].versions[0].content).toBe('The answer')
    expect(result[0].sources).toEqual(sources)
    expect(result[1]).toBe(messages[1])
  })
})

describe('extractManagedSearchResult', () => {
  it('extracts output text and deduplicates safe annotation and xAI citations', () => {
    const result = extractManagedSearchResult({
      status: 'completed',
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: 'Answer',
              annotations: [
                { url: 'https://Example.com/a#one', title: 'Example' },
                { url: 'https://example.com/a#two' },
                { url: 'javascript:alert(1)' },
              ],
            },
          ],
        },
      ],
      citations: ['https://x.com/post/1', 'file:///etc/passwd'],
    })

    expect(result.text).toBe('Answer')
    expect(result.sources.map((source) => source.href)).toEqual([
      'https://example.com/a',
      'https://x.com/post/1',
    ])
  })

  it('rejects a response without assistant text', () => {
    expect(() =>
      extractManagedSearchResult({ status: 'completed', output: [] })
    ).toThrow('Search returned an empty answer')
  })

  it.each(['incomplete', 'failed'])(
    'rejects %s responses even when they contain text',
    (status) => {
      expect(() =>
        extractManagedSearchResult({
          status,
          output: [
            {
              content: [{ type: 'output_text', text: 'unsafe partial answer' }],
            },
          ],
        })
      ).toThrow('Search did not complete')
    }
  )
})
