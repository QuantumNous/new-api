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
import { INTERFACE_LANGUAGE_OPTIONS } from '@/i18n/languages'

export const CUSTOM_NAV_PLACEMENTS = ['sidebar', 'header', 'both'] as const
export const CUSTOM_NAV_SIDEBAR_SECTIONS = [
  'chat',
  'general',
  'personal',
  'admin',
] as const
export const CUSTOM_NAV_CONTENT_TYPES = ['html', 'markdown', 'url'] as const

export const CUSTOM_NAV_MAX_ITEMS = 20
export const CUSTOM_NAV_MAX_CONTENT_LENGTH = 20_000
export const CUSTOM_NAV_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

export type CustomNavPlacement = (typeof CUSTOM_NAV_PLACEMENTS)[number]
export type CustomNavSidebarSection =
  (typeof CUSTOM_NAV_SIDEBAR_SECTIONS)[number]
export type CustomNavContentType = (typeof CUSTOM_NAV_CONTENT_TYPES)[number]

export type CustomNavItem = {
  id: string
  labels: Record<string, string>
  icon: string
  placement: CustomNavPlacement
  sidebarSection: CustomNavSidebarSection
  contentType: CustomNavContentType
  content: string
  enabled: boolean
}

const LANGUAGE_CODES = INTERFACE_LANGUAGE_OPTIONS.map((option) => option.code)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseLabels(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {}

  const labels: Record<string, string> = {}
  for (const code of LANGUAGE_CODES) {
    const value = raw[code]
    if (typeof value === 'string' && value.trim()) {
      labels[code] = value.trim()
    }
  }
  return labels
}

function parseEnumValue<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

/**
 * Label for the active interface language, falling back to English and then to
 * any configured language so a button is never rendered without a name.
 */
export function resolveCustomNavLabel(
  item: CustomNavItem,
  language: string
): string {
  return (
    item.labels[language] ??
    item.labels.en ??
    Object.values(item.labels)[0] ??
    item.id
  )
}

export function parseCustomNavItems(
  value: string | null | undefined
): CustomNavItem[] {
  if (!value || !value.trim()) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    const seen = new Set<string>()
    const items: CustomNavItem[] = []

    for (const raw of parsed) {
      if (!isRecord(raw)) continue

      const id = typeof raw.id === 'string' ? raw.id.trim() : ''
      if (!CUSTOM_NAV_ID_PATTERN.test(id) || seen.has(id)) continue

      const labels = parseLabels(raw.labels)
      if (Object.keys(labels).length === 0) continue

      const content = typeof raw.content === 'string' ? raw.content : ''
      if (!content.trim()) continue

      seen.add(id)
      items.push({
        id,
        labels,
        icon: typeof raw.icon === 'string' ? raw.icon.trim() : '',
        placement: parseEnumValue(
          raw.placement,
          CUSTOM_NAV_PLACEMENTS,
          'sidebar'
        ),
        sidebarSection: parseEnumValue(
          raw.sidebarSection,
          CUSTOM_NAV_SIDEBAR_SECTIONS,
          'general'
        ),
        contentType: parseEnumValue(
          raw.contentType,
          CUSTOM_NAV_CONTENT_TYPES,
          'markdown'
        ),
        content,
        enabled: raw.enabled !== false,
      })

      if (items.length >= CUSTOM_NAV_MAX_ITEMS) break
    }

    return items
  } catch {
    return []
  }
}

export function serializeCustomNavItems(items: CustomNavItem[]): string {
  return JSON.stringify(items)
}

export function isSafeCustomNavUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export type CustomNavValidationError =
  | 'id'
  | 'duplicate-id'
  | 'label'
  | 'content'
  | 'content-length'
  | 'url'

/**
 * Validation shared by the admin form; mirrors the backend checks so invalid
 * items are reported before saving.
 */
export function validateCustomNavItems(
  items: CustomNavItem[]
): Map<string, CustomNavValidationError> {
  const errors = new Map<string, CustomNavValidationError>()
  const seen = new Set<string>()

  for (const item of items) {
    if (!CUSTOM_NAV_ID_PATTERN.test(item.id)) {
      errors.set(item.id, 'id')
      continue
    }
    if (seen.has(item.id)) {
      errors.set(item.id, 'duplicate-id')
      continue
    }
    seen.add(item.id)

    if (Object.values(item.labels).every((label) => !label.trim())) {
      errors.set(item.id, 'label')
      continue
    }
    if (!item.content.trim()) {
      errors.set(item.id, 'content')
      continue
    }
    if (item.content.length > CUSTOM_NAV_MAX_CONTENT_LENGTH) {
      errors.set(item.id, 'content-length')
      continue
    }
    if (item.contentType === 'url' && !isSafeCustomNavUrl(item.content)) {
      errors.set(item.id, 'url')
    }
  }

  return errors
}

export function createCustomNavItem(index: number): CustomNavItem {
  return {
    id: `custom-${index + 1}`,
    labels: {},
    icon: '',
    placement: 'sidebar',
    sidebarSection: 'general',
    contentType: 'markdown',
    content: '',
    enabled: true,
  }
}
