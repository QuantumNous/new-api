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
  findSensitiveWordMatches,
  getNextSensitiveWordMatchIndex,
  parseSensitiveWordDraftWords,
} from './draft-search'

describe('sensitive-word draft search', () => {
  it('finds all case-insensitive matches and ignores blank queries', () => {
    expect(findSensitiveWordMatches('Alpha\nalpha\nBETA', ' alpha ')).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ])
    expect(findSensitiveWordMatches('Alpha', '   ')).toEqual([])
  })

  it('wraps forwards and backwards through matches', () => {
    expect(getNextSensitiveWordMatchIndex(0, 3)).toBe(1)
    expect(getNextSensitiveWordMatchIndex(2, 3)).toBe(0)
    expect(getNextSensitiveWordMatchIndex(0, 3, true)).toBe(2)
    expect(getNextSensitiveWordMatchIndex(0, 0)).toBe(0)
  })

  it('keeps UTF-16 ranges stable and deduplicates save words', () => {
    expect(findSensitiveWordMatches('\u{1F600}Sensitive', 'sensitive')).toEqual(
      [{ start: 2, end: 11 }]
    )
    expect(findSensitiveWordMatches('\u0130stanbul', 'i\u0307')).toEqual([
      { start: 0, end: 1 },
    ])
    expect(parseSensitiveWordDraftWords(' Alpha\nalpha\n\nBeta ')).toEqual([
      'Alpha',
      'Beta',
    ])
  })
})
