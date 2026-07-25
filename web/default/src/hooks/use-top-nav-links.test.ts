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
import { parseHeaderNavModules } from '@/lib/nav-modules'
import { buildTopNavLinks } from './use-top-nav-links'

const translate = (key: string) => {
  if (key === 'Playground (website navigation)') return 'Playground'
  if (key === 'Pricing (website navigation)') return 'Pricing'
  return key
}

describe('top navigation links', () => {
  test('keeps Home and Blog before the official website navigation', () => {
    const links = buildTopNavLinks({
      translate,
      language: 'en',
      modules: parseHeaderNavModules({
        pricing: { enabled: true, requireAuth: false },
        rankings: { enabled: true, requireAuth: false },
      }),
      isAuthed: false,
    })

    assert.deepEqual(
      links.map((link) => [link.title, link.href]),
      [
        ['Home', '/'],
        ['Blog', '/blog'],
        ['Models', '/models'],
        ['Docs', 'https://docs.flatkey.ai/'],
        ['Playground', '/playground'],
        ['Rankings', '/models#leaderboard'],
        ['Pricing', '/pricing'],
        ['Compute', '/compute'],
        ['Use cases', '/usecases'],
      ]
    )
  })

  test('preserves pricing and rankings access controls', () => {
    const links = buildTopNavLinks({
      translate,
      modules: parseHeaderNavModules({
        pricing: { enabled: true, requireAuth: true },
        rankings: { enabled: false, requireAuth: false },
      }),
      isAuthed: false,
    })

    assert.equal(
      links.some((link) => link.title === 'Rankings'),
      false
    )
    assert.equal(
      links.find((link) => link.title === 'Pricing')?.requiresAuth,
      true
    )
  })
})
