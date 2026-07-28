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
import { getMarketplacePlatforms } from './platforms'

describe('Marketplace platform categories', () => {
  test('hides Monid and Deepline without removing provider tools', () => {
    const platforms = [
      { platform: 'Monid', count: 1653 },
      { platform: 'Deepline', count: 1520 },
      { platform: 'Smartlead', count: 112 },
      { platform: 'NewsAPI.ai', count: 37 },
    ]

    expect(getMarketplacePlatforms(platforms)).toEqual([
      { platform: 'Smartlead', count: 112 },
      { platform: 'NewsAPI.ai', count: 37 },
    ])
    expect(platforms).toHaveLength(4)
  })

  test('matches internal provider categories case-insensitively', () => {
    expect(
      getMarketplacePlatforms([
        { platform: ' monid ', count: 1 },
        { platform: 'DEEPLINE', count: 1 },
        { platform: 'BuiltWith', count: 16 },
      ])
    ).toEqual([{ platform: 'BuiltWith', count: 16 }])
  })
})
