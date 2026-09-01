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

import { buildPublicTopNavLinks } from '@/hooks/use-top-nav-links'
import { parseHeaderNavModules } from '@/lib/nav-modules'

const translate = (key: string) => key

describe('public top navigation', () => {
  it('keeps the signed-out header focused on pricing, onboarding, and API access', () => {
    const links = buildPublicTopNavLinks({
      modules: parseHeaderNavModules(null),
      isAuthed: false,
      translate,
    })

    expect(links.map((link) => link.title)).toEqual([
      'Model Price',
      'Beginner guide',
      'API Access',
    ])
    expect(links.map((link) => link.href)).toEqual([
      '/pricing',
      '/guide',
      '/docs',
    ])
  })

  it('adds the console for signed-in users without restoring secondary links', () => {
    const links = buildPublicTopNavLinks({
      modules: parseHeaderNavModules(null),
      isAuthed: true,
      translate,
    })

    expect(links.map((link) => link.title)).toEqual([
      'Console',
      'Model Price',
      'Beginner guide',
      'API Access',
    ])
    expect(links).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Home' }),
        expect.objectContaining({ title: 'Rankings' }),
        expect.objectContaining({ title: 'About' }),
      ])
    )
  })

  it('respects disabled public modules while keeping the beginner guide visible', () => {
    const links = buildPublicTopNavLinks({
      modules: parseHeaderNavModules({
        console: false,
        pricing: false,
        docs: false,
      }),
      isAuthed: true,
      translate,
    })

    expect(links).toEqual([{ title: 'Beginner guide', href: '/guide' }])
  })

  it('preserves protected pricing and external API documentation behavior', () => {
    const links = buildPublicTopNavLinks({
      modules: parseHeaderNavModules({
        pricing: { enabled: true, requireAuth: true },
      }),
      docsLink: 'https://docs.example.com',
      isAuthed: false,
      translate,
    })

    expect(links).toContainEqual({
      title: 'Model Price',
      href: '/pricing',
      requiresAuth: true,
    })
    expect(links).toContainEqual({
      title: 'API Access',
      href: 'https://docs.example.com',
      external: true,
    })
  })
})
