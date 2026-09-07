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
import type { BillingUsageSchema } from '../types'
import type { ParsedTaskTier } from './billing-expr'
import {
  getTaskEnumFields,
  taskMatrixRowLabel,
  tryParseTaskMatrixConfig,
} from './task-expr'

/**
 * Marketplace display helper: expand a recognized task matrix (flat/uniform
 * or a full enum partition) into one row per combination. Returns null when
 * the schema has no enum fields or the expression is not a recognized matrix,
 * so callers keep the raw parsed-tier display.
 */
export function getTaskMatrixDisplayTiers(
  expression: string | null | undefined,
  schema: BillingUsageSchema | null | undefined
): ParsedTaskTier[] | null {
  if (!schema) return null
  if (getTaskEnumFields(schema).length === 0) return null

  const matrix = tryParseTaskMatrixConfig(expression, schema)
  if (!matrix) return null

  return matrix.rows.map((row) => ({
    label: taskMatrixRowLabel(row.combination),
    conditions: Object.entries(row.combination)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, value]) => ({ field, value })),
    constant: row.constant,
    unitPrices: { ...row.unitPrices },
  }))
}
