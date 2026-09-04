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

import { mergeSources, parseUrlCitations } from '../citations'

describe('parseUrlCitations', () => {
  test('extracts safe URL citations and keeps the first title for duplicates', () => {
    const sources = parseUrlCitations([
      {
        type: 'url_citation',
        url_citation: { url: 'https://example.com/report', title: 'Report' },
      },
      {
        type: 'url_citation',
        url_citation: {
          url: 'https://example.com/report',
          title: 'Duplicate title',
        },
      },
      {
        type: 'url_citation',
        url_citation: { url: 'http://example.org/source' },
      },
    ])

    expect(sources).toEqual([
      { href: 'https://example.com/report', title: 'Report' },
      { href: 'http://example.org/source', title: 'http://example.org/source' },
    ])
  })

  test('ignores unsafe URLs and malformed annotations', () => {
    const sources = parseUrlCitations([
      {
        type: 'url_citation',
        url_citation: { url: 'javascript:alert(1)', title: 'Unsafe' },
      },
      {
        type: 'url_citation',
        url_citation: { url: 'ftp://example.com/file', title: 'FTP' },
      },
      { type: 'url_citation', url_citation: { url: 42 } },
      { type: 'other', url_citation: { url: 'https://example.com' } },
      null,
    ])

    expect(sources).toEqual([])
  })
})

describe('mergeSources', () => {
  test('appends only previously unseen URLs in incoming order', () => {
    const sources = mergeSources(
      [{ href: 'https://a.example', title: 'A' }],
      [
        { href: 'https://a.example', title: 'Changed A' },
        { href: 'https://b.example', title: 'B' },
      ]
    )

    expect(sources).toEqual([
      { href: 'https://a.example', title: 'A' },
      { href: 'https://b.example', title: 'B' },
    ])
  })
})
