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
export interface BusinessContact {
  id: string
  label: string
  image: string
}

export function parseBusinessContacts(value?: string): BusinessContact[] {
  if (!value) return []
  // Preserve previously saved single-image configurations.
  if (/^(https?:\/\/|data:image\/)/.test(value)) {
    return [{ id: 'legacy', label: 'Business cooperation', image: value }]
  }
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is { id?: unknown; label: string; image: string } =>
          !!item &&
          typeof item === 'object' &&
          typeof item.label === 'string' &&
          typeof item.image === 'string'
      )
      .map((item, index) => ({
        ...item,
        id:
          typeof item.id === 'string' && item.id ? item.id : `legacy-${index}`,
      }))
  } catch {
    return []
  }
}
