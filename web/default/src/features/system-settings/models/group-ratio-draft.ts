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

const GROUP_RATIO_DRAFT_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d*)?$/

export function isGroupRatioDraft(value: string): boolean {
  return GROUP_RATIO_DRAFT_PATTERN.test(value)
}

export function parseGroupRatioDraft(value: string): number | null {
  const draft = value.trim()
  if (draft === '' || draft === '.') return null
  if (!isGroupRatioDraft(draft)) return null

  const parsed = Number(draft)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function commitGroupRatioDraft(value: string): number {
  return parseGroupRatioDraft(value) ?? 0
}

export function formatGroupRatioDraft(value: number | string): string {
  if (value === '') return ''
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : '0'
  return value
}
