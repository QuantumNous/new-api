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
  DEFAULT_LOGO,
  DEFAULT_SYSTEM_NAME,
  resolveLogoUrl,
  resolveSystemName,
} from '../constants'

describe('resolveSystemName', () => {
  it('keeps the protected project default', () => {
    expect(DEFAULT_SYSTEM_NAME).toBe('New API')
  })

  it.each([undefined, null, '', '  ', 'New API'])(
    'preserves the protected New API default for empty or existing value %s',
    (value) => {
      expect(resolveSystemName(value)).toBe(DEFAULT_SYSTEM_NAME)
    }
  )

  it('preserves an operator-defined system name', () => {
    expect(resolveSystemName('  Custom API  ')).toBe('Custom API')
  })
})

describe('resolveLogoUrl', () => {
  it('uses the YesChoy 野 mark as the product default', () => {
    expect(DEFAULT_LOGO).toBe('/yeschoy-mark.svg')
  })

  it.each([
    undefined,
    null,
    '',
    '  ',
    '/logo.png',
    'logo.png',
    '/yecai-logo.svg',
    'yecai-logo.svg',
    '/yecai-logo-mascot.svg',
    '/yecai-logo-dark-tile.svg',
  ])(
    'maps empty or retired built-in logo %s to the current default',
    (value) => {
      expect(resolveLogoUrl(value)).toBe(DEFAULT_LOGO)
    }
  )

  it('preserves an operator-defined logo URL', () => {
    expect(resolveLogoUrl(' https://example.com/custom.svg ')).toBe(
      'https://example.com/custom.svg'
    )
  })
})
