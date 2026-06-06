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
import type { TFunction } from 'i18next'

export const BRAND_NAME_EN = 'BabelTower'

const LEGACY_DEFAULT_NAMES = new Set([
  '',
  'New API',
  'NewAPI',
  'RedShore',
  BRAND_NAME_EN,
])

export function getDisplayBrandName(
  systemName: string | undefined,
  t: TFunction
): string {
  const normalized = (systemName || '').trim()
  if (!normalized || LEGACY_DEFAULT_NAMES.has(normalized)) {
    return t('brand.name')
  }
  return normalized
}

export function applyBrandDocumentTitle(
  t: TFunction,
  systemName?: string
): void {
  if (typeof document === 'undefined') return

  const name = getDisplayBrandName(systemName, t)
  document.title = name

  const metaTitle = document.querySelector(
    'meta[name="title"]'
  ) as HTMLMetaElement | null
  if (metaTitle) {
    metaTitle.setAttribute('content', name)
  }
}
