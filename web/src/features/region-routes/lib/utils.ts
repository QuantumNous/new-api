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
*/

// Split a comma-separated channel id string into a numeric array.
export function splitChannelIds(value: string | undefined | null): number[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => Number(part))
    .filter((num) => !Number.isNaN(num))
}

// Join a numeric channel id array into a comma-separated string.
export function joinChannelIds(ids: number[] | undefined | null): string {
  if (!ids || ids.length === 0) return ''
  return ids.join(',')
}

// Build an id -> name map from a list of channels for display purposes.
export function buildChannelNameMap(
  channels: { id: number; name: string }[]
): Record<number, string> {
  const map: Record<number, string> = {}
  for (const channel of channels) {
    map[channel.id] = channel.name
  }
  return map
}
