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
  createCustomNavItem,
  isSafeCustomNavUrl,
  parseCustomNavItems,
  resolveCustomNavLabel,
  serializeCustomNavItems,
  validateCustomNavItems,
  type CustomNavItem,
} from '../custom-nav-config'

function buildItem(overrides: Partial<CustomNavItem> = {}): CustomNavItem {
  return {
    id: 'docs',
    labels: { en: 'Docs' },
    icon: 'FiBook',
    placement: 'sidebar',
    sidebarSection: 'general',
    contentType: 'markdown',
    content: '# Docs',
    enabled: true,
    ...overrides,
  }
}

describe('parseCustomNavItems', () => {
  it('returns an empty list when the option is unset', () => {
    expect(parseCustomNavItems(undefined)).toEqual([])
    expect(parseCustomNavItems('')).toEqual([])
  })

  it('returns an empty list for malformed JSON', () => {
    expect(parseCustomNavItems('{not json')).toEqual([])
  })

  it('keeps a valid item and applies defaults for unknown enum values', () => {
    const raw = JSON.stringify([
      {
        id: 'docs',
        labels: { en: 'Docs', zhCN: '文档' },
        icon: 'FiBook',
        placement: 'nowhere',
        sidebarSection: 'secret',
        contentType: 'binary',
        content: '# Docs',
      },
    ])

    const items = parseCustomNavItems(raw)

    expect(items).toHaveLength(1)
    expect(items[0].placement).toBe('sidebar')
    expect(items[0].sidebarSection).toBe('general')
    expect(items[0].contentType).toBe('markdown')
    expect(items[0].enabled).toBe(true)
  })

  it('drops items with an invalid identifier, no label or no content', () => {
    const raw = JSON.stringify([
      { id: 'Bad Id', labels: { en: 'A' }, content: 'a' },
      { id: 'no-label', labels: {}, content: 'a' },
      { id: 'no-content', labels: { en: 'A' }, content: '   ' },
    ])

    expect(parseCustomNavItems(raw)).toEqual([])
  })

  it('drops duplicate identifiers and keeps the first occurrence', () => {
    const raw = JSON.stringify([
      { id: 'docs', labels: { en: 'First' }, content: 'a' },
      { id: 'docs', labels: { en: 'Second' }, content: 'b' },
    ])

    const items = parseCustomNavItems(raw)

    expect(items).toHaveLength(1)
    expect(items[0].labels.en).toBe('First')
  })

  it('round-trips through serialization', () => {
    const items = [buildItem()]

    expect(parseCustomNavItems(serializeCustomNavItems(items))).toEqual(items)
  })
})

describe('resolveCustomNavLabel', () => {
  it('prefers the active language label', () => {
    const item = buildItem({ labels: { en: 'Docs', zhCN: '文档' } })

    expect(resolveCustomNavLabel(item, 'zhCN')).toBe('文档')
  })

  it('falls back to English when the active language has no label', () => {
    const item = buildItem({ labels: { en: 'Docs' } })

    expect(resolveCustomNavLabel(item, 'ja')).toBe('Docs')
  })

  it('falls back to any configured label when English is missing', () => {
    const item = buildItem({ labels: { fr: 'Documentation' } })

    expect(resolveCustomNavLabel(item, 'ja')).toBe('Documentation')
  })
})

describe('isSafeCustomNavUrl', () => {
  it('accepts http and https urls', () => {
    expect(isSafeCustomNavUrl('https://example.com/docs')).toBe(true)
    expect(isSafeCustomNavUrl('http://example.com')).toBe(true)
  })

  it('rejects javascript and data urls', () => {
    expect(isSafeCustomNavUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeCustomNavUrl('data:text/html,<h1>x</h1>')).toBe(false)
    expect(isSafeCustomNavUrl('not a url')).toBe(false)
  })
})

describe('validateCustomNavItems', () => {
  it('reports no errors for a valid item', () => {
    expect(validateCustomNavItems([buildItem()]).size).toBe(0)
  })

  it('reports an invalid identifier', () => {
    expect(
      validateCustomNavItems([buildItem({ id: 'Bad Id' })]).get('Bad Id')
    ).toBe('id')
  })

  it('reports duplicate identifiers', () => {
    const errors = validateCustomNavItems([buildItem(), buildItem()])

    expect(errors.get('docs')).toBe('duplicate-id')
  })

  it('reports a missing label', () => {
    expect(
      validateCustomNavItems([buildItem({ labels: {} })]).get('docs')
    ).toBe('label')
  })

  it('reports empty content', () => {
    expect(
      validateCustomNavItems([buildItem({ content: '  ' })]).get('docs')
    ).toBe('content')
  })

  it('reports an unsafe url for url content', () => {
    const item = buildItem({ contentType: 'url', content: 'javascript:x' })

    expect(validateCustomNavItems([item]).get('docs')).toBe('url')
  })
})

describe('createCustomNavItem', () => {
  it('creates a sidebar markdown item with a positional identifier', () => {
    const item = createCustomNavItem(1)

    expect(item.id).toBe('custom-2')
    expect(item.placement).toBe('sidebar')
    expect(item.contentType).toBe('markdown')
    expect(item.enabled).toBe(true)
  })
})
