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

import {
  encodeChannelConnectionInfo,
  maskChannelKey,
  normalizeChannelBaseUrl,
  parseChannelConnectionInfo,
  parseChannelConnectionInfos,
} from '../channel-connection-info'

describe('parseChannelConnectionInfo', () => {
  it('keeps the existing encoded connection-info contract', () => {
    const encoded = encodeChannelConnectionInfo(
      'sk-existing-contract',
      'https://api.example.com'
    )

    expect(parseChannelConnectionInfo(encoded)).toEqual({
      key: 'sk-existing-contract',
      url: 'https://api.example.com',
    })
  })
})

describe('parseChannelConnectionInfos', () => {
  it('groups multiple unique keys under the only URL', () => {
    const result = parseChannelConnectionInfos(`
      URL: https://api.example.com/v1
      API Key: sk-first-example-key
      sk-second-example-key
      sk-first-example-key
    `)

    expect(result.groups).toEqual([
      {
        url: 'https://api.example.com',
        keys: ['sk-first-example-key', 'sk-second-example-key'],
        confidence: 'high',
      },
    ])
    expect(result.unmatchedKeys).toEqual([])
    expect(result.unmatchedUrls).toEqual([])
  })

  it('keeps blank-line-separated URL and key blocks as separate groups', () => {
    const result = parseChannelConnectionInfos(`
      https://one.example.com/v1
      sk-key-for-provider-one

      https://two.example.com/v1/models
      sk-key-for-provider-two
      sk-another-key-for-two
    `)

    expect(result.groups).toEqual([
      {
        url: 'https://one.example.com',
        keys: ['sk-key-for-provider-one'],
        confidence: 'high',
      },
      {
        url: 'https://two.example.com',
        keys: ['sk-key-for-provider-two', 'sk-another-key-for-two'],
        confidence: 'high',
      },
    ])
  })

  it('pairs adjacent URL and key records by order without blank lines', () => {
    const result = parseChannelConnectionInfos(`
      url=https://one.example.com/v1 key=sk-key-for-one-record
      url=https://two.example.com/v1 key=sk-key-for-two-record
    `)

    expect(result.groups).toEqual([
      {
        url: 'https://one.example.com',
        keys: ['sk-key-for-one-record'],
        confidence: 'medium',
      },
      {
        url: 'https://two.example.com',
        keys: ['sk-key-for-two-record'],
        confidence: 'medium',
      },
    ])
    expect(result.unmatchedKeys).toEqual([])
  })

  it('does not guess when several URLs share an unassigned key', () => {
    const result = parseChannelConnectionInfos(`
      https://one.example.com
      https://two.example.com
      sk-ambiguous-provider-key
    `)

    expect(result.groups).toEqual([])
    expect(result.unmatchedKeys).toEqual(['sk-ambiguous-provider-key'])
    expect(result.unmatchedUrls).toEqual([
      'https://one.example.com',
      'https://two.example.com',
    ])
  })

  it('extracts common URL and key fields from JSON arrays', () => {
    const result = parseChannelConnectionInfos(
      JSON.stringify([
        {
          base_url: 'https://one.example.com/v1/chat/completions',
          api_key: 'sk-json-provider-one',
        },
        {
          endpoint: 'https://two.example.com/v1',
          keys: ['sk-json-provider-two-a', 'sk-json-provider-two-b'],
        },
      ])
    )

    expect(result.groups).toEqual([
      {
        url: 'https://one.example.com',
        keys: ['sk-json-provider-one'],
        confidence: 'high',
      },
      {
        url: 'https://two.example.com',
        keys: ['sk-json-provider-two-a', 'sk-json-provider-two-b'],
        confidence: 'high',
      },
    ])
  })

  it('ignores non-http URLs and reports otherwise valid keys as unmatched', () => {
    const result = parseChannelConnectionInfos(
      'file:///tmp/upstream\nsk-valid-but-unmatched-key'
    )

    expect(result.groups).toEqual([])
    expect(result.unmatchedKeys).toEqual(['sk-valid-but-unmatched-key'])
    expect(result.unmatchedUrls).toEqual([])
  })
})

describe('normalizeChannelBaseUrl', () => {
  it.each([
    ['https://API.Example.com/v1/', 'https://api.example.com'],
    [
      'https://api.example.com/openai/v1/chat/completions?debug=1',
      'https://api.example.com/openai',
    ],
    [
      'https://api.example.com/root/v1/models#models',
      'https://api.example.com/root',
    ],
    ['https://api.example.com/root/', 'https://api.example.com/root'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeChannelBaseUrl(input)).toBe(expected)
  })

  it('rejects embedded credentials', () => {
    expect(normalizeChannelBaseUrl('https://user:pass@example.com/v1')).toBe(
      null
    )
  })
})

describe('maskChannelKey', () => {
  it('shows enough of a key to distinguish it without revealing the secret', () => {
    expect(maskChannelKey('sk-abcdefghijklmnopqrstuvwxyz')).toBe(
      'sk-abcd••••••wxyz'
    )
    expect(maskChannelKey('sk-short')).toBe('sk••••rt')
  })
})
