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
export const MAX_CUSTOM_PAGES = 20
export const MAX_CUSTOM_PAGE_NAME_LENGTH = 30
export const MAX_CUSTOM_PAGE_URL_LENGTH = 500

export const CUSTOM_PAGE_HIGHLIGHT_COLORS = [
  '',
  'blue',
  'green',
  'purple',
  'orange',
  'red',
] as const
export type CustomPageHighlightColor =
  (typeof CUSTOM_PAGE_HIGHLIGHT_COLORS)[number]

export type CustomPage = {
  name: string
  url: string
  adminOnly: boolean
  highlight: boolean
  highlightColor?: CustomPageHighlightColor
}

export type CustomPageLink = CustomPage & { slug: string; href: string }

export function isCustomPageURL(value: string): boolean {
  if (!/^https?:\/\/[^/\\]/i.test(value) || /[\s\\]/u.test(value)) return false
  try {
    const url = new URL(value)
    return (
      Boolean(url.hostname) &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    )
  } catch {
    return false
  }
}

export function normalizeCustomPages(value: unknown): CustomPage[] {
  if (!Array.isArray(value)) return []
  const pages: CustomPage[] = []
  const names = new Set<string>()
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.name !== 'string' ||
      typeof entry.url !== 'string'
    ) {
      continue
    }
    if (
      (entry.adminOnly !== undefined && typeof entry.adminOnly !== 'boolean') ||
      (entry.highlight !== undefined && typeof entry.highlight !== 'boolean') ||
      (entry.highlightColor !== undefined &&
        !CUSTOM_PAGE_HIGHLIGHT_COLORS.includes(entry.highlightColor))
    ) {
      continue
    }
    const name = entry.name.trim()
    const url = entry.url.trim()
    if (
      !name ||
      /[\r\n\t]/.test(entry.name) ||
      [...name].length > MAX_CUSTOM_PAGE_NAME_LENGTH ||
      [...url].length > MAX_CUSTOM_PAGE_URL_LENGTH ||
      !isCustomPageURL(url) ||
      names.has(name.toLowerCase())
    ) {
      continue
    }
    names.add(name.toLowerCase())
    pages.push({
      name,
      url,
      adminOnly: entry.adminOnly ?? false,
      highlight: entry.highlight ?? false,
      ...(entry.highlightColor ? { highlightColor: entry.highlightColor } : {}),
    })
    if (pages.length === MAX_CUSTOM_PAGES) break
  }
  return pages
}

export function customPageSlug(name: string, index: number): string {
  return (
    name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '')
      .slice(0, 40)
      .replaceAll(/-$/g, '') || `page-${index + 1}`
  )
}

export function buildCustomPageLinks(pages: CustomPage[]): CustomPageLink[] {
  const used = new Set<string>()
  return pages.map((page, index) => {
    const base = customPageSlug(page.name, index)
    let slug = base
    let suffix = 2
    while (used.has(slug)) slug = `${base}-${suffix++}`
    used.add(slug)
    return { ...page, slug, href: `/embed/${slug}` }
  })
}

export function parseCustomPagesOption(raw: string): CustomPage[] {
  try {
    return normalizeCustomPages(JSON.parse(raw))
  } catch {
    return []
  }
}

export function serializeCustomPages(pages: CustomPage[]): string {
  return JSON.stringify(
    pages.map((page) => ({
      name: page.name.trim(),
      url: page.url.trim(),
      adminOnly: page.adminOnly,
      highlight: page.highlight,
      ...(page.highlightColor ? { highlightColor: page.highlightColor } : {}),
    }))
  )
}
