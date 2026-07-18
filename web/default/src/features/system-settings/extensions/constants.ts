/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  Bookmark,
  BookOpen,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe,
  HelpCircle,
  Layout,
  Link,
  Newspaper,
  type LucideIcon,
} from 'lucide-react'

export const CUSTOM_PAGE_ICON_OPTIONS = [
  { value: 'Link', icon: Link },
  { value: 'BookOpen', icon: BookOpen },
  { value: 'ExternalLink', icon: ExternalLink },
  { value: 'FileText', icon: FileText },
  { value: 'Globe', icon: Globe },
  { value: 'Layout', icon: Layout },
  { value: 'Newspaper', icon: Newspaper },
  { value: 'HelpCircle', icon: HelpCircle },
  { value: 'Bookmark', icon: Bookmark },
  { value: 'FolderOpen', icon: FolderOpen },
] as const

export type CustomPageIconName =
  (typeof CUSTOM_PAGE_ICON_OPTIONS)[number]['value']

export const DEFAULT_CUSTOM_PAGE_ICON: CustomPageIconName = 'Link'

export const CUSTOM_PAGE_OPEN_MODES = [
  { value: 'embed', labelKey: 'Embed in console' },
  { value: 'external', labelKey: 'Open in new tab' },
] as const

export type CustomPageOpenMode =
  (typeof CUSTOM_PAGE_OPEN_MODES)[number]['value']

export const DEFAULT_CUSTOM_PAGE_OPEN_MODE: CustomPageOpenMode = 'embed'

export const EXTENSION_VISIBILITY_OPTIONS = [
  { value: 'all', labelKey: 'Everyone' },
  { value: 'admin', labelKey: 'Admins only' },
] as const

export type ExtensionVisibility =
  (typeof EXTENSION_VISIBILITY_OPTIONS)[number]['value']

export const DEFAULT_EXTENSION_VISIBILITY: ExtensionVisibility = 'all'

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CUSTOM_PAGE_ICON_OPTIONS.map((item) => [item.value, item.icon])
)

export function resolveCustomPageIcon(
  iconName: string | undefined | null
): LucideIcon {
  if (!iconName) return Link
  return ICON_MAP[iconName] ?? Link
}

export function resolveCustomPageOpenMode(
  openMode: string | undefined | null
): CustomPageOpenMode {
  if (openMode === 'external') return 'external'
  return 'embed'
}

export function resolveExtensionVisibility(
  visibility: string | undefined | null
): ExtensionVisibility {
  if (visibility === 'admin') return 'admin'
  return 'all'
}

export type CustomPage = {
  id: string
  title: string
  icon: string
  url: string
  open_mode: CustomPageOpenMode
  visibility: ExtensionVisibility
  enabled: boolean
  sort: number
}

export type CustomPageStatusItem = {
  id: string
  title: string
  icon: string
  url: string
  open_mode?: CustomPageOpenMode
}

export function createCustomPageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cp_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
  }
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
