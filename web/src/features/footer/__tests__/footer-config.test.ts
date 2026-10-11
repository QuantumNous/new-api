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

import {
  createDefaultFooterConfig,
  isFooterLinkUrl,
  parseFooterConfig,
} from '../types'

describe('footer config', () => {
  test('parses configurable social links and footer columns', () => {
    const config = createDefaultFooterConfig()

    expect(parseFooterConfig(JSON.stringify(config))).toEqual(config)
  })

  test.each([
    'javascript:alert(1)',
    '//example.com/path',
    'ftp://example.com/file',
    '/path\\to\\file',
  ])('rejects unsafe footer destination %s', (url) => {
    expect(isFooterLinkUrl(url)).toBe(false)
  })

  test.each([
    '/pricing',
    '/#models',
    'https://example.com/docs',
    'mailto:support@example.com',
  ])('accepts supported footer destination %s', (url) => {
    expect(isFooterLinkUrl(url)).toBe(true)
  })
})

test('preserves multiple registration records and rejects unsafe destinations', () => {
  const config = {
    ...createDefaultFooterConfig(),
    registrations: [
      {
        id: 'icp',
        label: '京ICP备123号',
        url: 'https://beian.miit.gov.cn/',
        icon: '',
      },
      {
        id: 'police',
        label: '京公网安备456号',
        url: 'https://beian.mps.gov.cn/',
        icon: '',
      },
    ],
  }
  expect(parseFooterConfig(config)).toEqual(config)
  expect(
    parseFooterConfig({
      ...config,
      registrations: [
        { ...config.registrations[0], url: 'javascript:alert(1)' },
      ],
    })
  ).toBeNull()
})
