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

import { customPagesSchema } from '@/features/custom-pages/lib/schema'

import {
  buildCustomPageLinks,
  customPageSlug,
  normalizeCustomPages,
  parseCustomPagesOption,
  serializeCustomPages,
} from '../custom-pages'

const page = {
  name: 'Status',
  url: 'https://status.example.com',
  adminOnly: false,
  highlight: true,
}

describe('custom page links', () => {
  it('Chinese names fall back to their one-based position', () => {
    expect(customPageSlug('状态页', 1)).toBe('page-2')
  })
  it('slugs normalize separators, trim them and truncate to 40 characters', () => {
    expect(customPageSlug(' -- Status / Page -- ', 0)).toBe('status-page')
    expect(customPageSlug('a'.repeat(50), 0)).toBe('a'.repeat(40))
  })
  it('slug conflicts use increasing suffixes including conflicts with existing suffixed names', () => {
    const names = ['A B', 'A-B', 'A-B-2', 'A_B', '状态页', 'Page 5']
    expect(
      buildCustomPageLinks(names.map((name) => ({ ...page, name }))).map(
        (link) => link.href
      )
    ).toEqual([
      '/embed/a-b',
      '/embed/a-b-2',
      '/embed/a-b-2-2',
      '/embed/a-b-3',
      '/embed/page-5',
      '/embed/page-5-2',
    ])
  })
})

describe('custom page options', () => {
  it('normalization trims values, defaults flags and removes unsafe or malformed entries', () => {
    expect(
      normalizeCustomPages([
        null,
        {},
        { ...page, adminOnly: 'false' },
        { ...page, url: 'javascript:alert(1)' },
        { ...page, url: '/page' },
        { ...page, url: 'https:///page' },
        { ...page, name: 'Bad\n' },
        { name: ' Status ', url: ' https://status.example.com ' },
        page,
      ])
    ).toEqual([{ ...page, highlight: false }])
    expect(normalizeCustomPages({ pages: [page] })).toEqual([])
  })
  it('parsing rejects malformed JSON and serialization preserves order and flags', () => {
    expect(parseCustomPagesOption('bad')).toEqual([])
    expect(parseCustomPagesOption('null')).toEqual([])
    const pages = [page, { ...page, name: '管理员', adminOnly: true }]
    expect(parseCustomPagesOption(serializeCustomPages(pages))).toEqual(pages)
    expect(
      JSON.parse(serializeCustomPages([{ ...page, name: ' Status ' }]))[0].name
    ).toBe('Status')
  })
  it('schema counts Unicode characters, accepts 30 runes and rejects 31', () => {
    expect(
      customPagesSchema.safeParse({
        pages: [{ ...page, name: '😀'.repeat(30) }],
      }).success
    ).toBe(true)
    expect(
      customPagesSchema.safeParse({
        pages: [{ ...page, name: '😀'.repeat(31) }],
      }).success
    ).toBe(false)
  })
  it.each([
    'javascript:alert(1)',
    'data:text/html,bad',
    '/page',
    'https:///page',
    'https://:443',
    'https://',
  ])('schema rejects unsafe or hostless URL %s', (url) => {
    expect(
      customPagesSchema.safeParse({ pages: [{ ...page, url }] }).success
    ).toBe(false)
  })
  it('schema rejects duplicate names, line breaks, long URLs and over 20 pages', () => {
    expect(
      customPagesSchema.safeParse({
        pages: [page, { ...page, name: ' status ' }],
      }).success
    ).toBe(false)
    expect(
      customPagesSchema.safeParse({ pages: [{ ...page, name: 'Status\n' }] })
        .success
    ).toBe(false)
    expect(
      customPagesSchema.safeParse({
        pages: [{ ...page, url: page.url + '/'.repeat(500) }],
      }).success
    ).toBe(false)
    expect(
      customPagesSchema.safeParse({
        pages: Array.from({ length: 21 }, (_, i) => ({
          ...page,
          name: `Page ${i}`,
        })),
      }).success
    ).toBe(false)
  })
})
