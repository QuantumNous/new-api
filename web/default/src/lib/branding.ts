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
import {
  DEFAULT_LOGO,
  DEFAULT_SYSTEM_NAME,
  LEGACY_DEFAULT_LOGO,
  LEGACY_DEFAULT_SYSTEM_NAME,
  LEGACY_SQUARE_LIGHTING_LOGO,
  LEGACY_WIDE_LIGHTING_LOGO,
} from '@/lib/constants'

export function resolveSystemName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SYSTEM_NAME

  const systemName = value.trim()
  if (!systemName || systemName === LEGACY_DEFAULT_SYSTEM_NAME) {
    return DEFAULT_SYSTEM_NAME
  }

  return systemName
}

export function resolveSystemLogo(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LOGO

  const logo = value.trim()
  if (!logo) return DEFAULT_LOGO

  try {
    const pathname = new URL(logo, 'https://lighting.invalid').pathname
    if (
      pathname === LEGACY_DEFAULT_LOGO ||
      pathname === LEGACY_SQUARE_LIGHTING_LOGO ||
      pathname === LEGACY_WIDE_LIGHTING_LOGO
    ) {
      return DEFAULT_LOGO
    }
  } catch {
    return DEFAULT_LOGO
  }

  return logo
}
