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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildTopNavLinks } from './use-top-nav-links'

const translate = (key: string) => key

describe('top navigation links', () => {
  test('shows only the Docs link in the console header', () => {
    const links = buildTopNavLinks({ translate })

    assert.deepEqual(
      links.map((link) => [link.title, link.href, link.external]),
      [['Docs', 'https://docs.flatkey.ai/', true]]
    )
  })

  test('never emits website navigation entries', () => {
    const links = buildTopNavLinks({ translate })

    for (const removed of [
      'Home',
      'Blog',
      'Models',
      'Pricing (website navigation)',
      'Compute',
      'Use cases',
      'Rankings',
      'Playground (website navigation)',
    ]) {
      assert.equal(
        links.some((link) => link.title === removed),
        false
      )
    }
  })
})
