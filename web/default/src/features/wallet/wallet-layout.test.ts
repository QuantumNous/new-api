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
import { readFileSync } from 'node:fs'

describe('Wallet top-up layout', () => {
  test('places the top-up button in the card header action', () => {
    const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

    expect(source).toMatch(
      /title=\{t\('Top-ups'\)\}[\s\S]*?action=\{[\s\S]*?\{t\('Top up'\)\}/
    )
    expect(source).toMatch(
      /contentClassName=\{\s*hasRechargeHistory \? 'space-y-4' : 'hidden'\s*\}/
    )
    expect(source).not.toContain("<div className='flex justify-end'>")
  })

  test('loads account recall offers on normal wallet visits and refreshes after claim validation', () => {
    const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

    expect(source).toContain('listRecallOffers')
    expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*?fetchRecallOffers/)
    expect(source).toMatch(
      /validateRecallClaim\(\{ claim: recallClaim \}\)[\s\S]*?\.finally\(\(\) => \{[\s\S]*?fetchRecallOffers/
    )
    expect(source).toContain('setRecallOffers')
  })
})
