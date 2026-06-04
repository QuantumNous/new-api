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
import type { FieldErrors, FieldValues } from 'react-hook-form'

const ADVANCED_ERROR_FIELDS = new Set([
  'param_override',
  'header_override',
  'status_code_mapping',
])

function isErrorLeaf(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return 'message' in record || 'type' in record || 'ref' in record
}

export function collectErrorFieldNames(
  errors: FieldErrors<FieldValues>,
  parentPath = ''
): string[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    const path = parentPath ? `${parentPath}.${key}` : key

    if (isErrorLeaf(value)) {
      return [path]
    }

    if (value && typeof value === 'object') {
      return collectErrorFieldNames(value as FieldErrors<FieldValues>, path)
    }

    return []
  })
}

export function isAdvancedSettingsErrorName(name: string): boolean {
  return ADVANCED_ERROR_FIELDS.has(name)
}

export function hasAdvancedSettingsErrors(
  errors: FieldErrors<FieldValues>
): boolean {
  return collectErrorFieldNames(errors).some(isAdvancedSettingsErrorName)
}
