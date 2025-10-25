// ============================================================================
// Sync Utilities
// ============================================================================

/**
 * Format sync result statistics into human-readable message
 *
 * @param data - Sync result data from API
 * @returns Formatted message string
 *
 * @example
 * ```ts
 * const result = { created_models: 5, updated_models: 3, created_vendors: 2 }
 * const message = formatSyncResultMessage(result)
 * // "5 models created, 3 models updated, 2 vendors created"
 * ```
 */
export function formatSyncResultMessage(data: {
  created_models?: number
  updated_models?: number
  created_vendors?: number
  skipped_models?: string[]
}): string {
  const {
    created_models = 0,
    updated_models = 0,
    created_vendors = 0,
    skipped_models = [],
  } = data

  const parts: string[] = []

  if (created_models > 0) {
    parts.push(
      `${created_models} model${created_models > 1 ? 's' : ''} created`
    )
  }

  if (updated_models > 0) {
    parts.push(
      `${updated_models} model${updated_models > 1 ? 's' : ''} updated`
    )
  }

  if (created_vendors > 0) {
    parts.push(
      `${created_vendors} vendor${created_vendors > 1 ? 's' : ''} created`
    )
  }

  if (skipped_models.length > 0) {
    parts.push(`${skipped_models.length} skipped`)
  }

  return parts.length > 0 ? parts.join(', ') : 'Sync completed'
}

// ============================================================================
// Conflict Resolution Utilities
// ============================================================================

/**
 * Format conflict field value for display in conflict resolution UI
 * Handles various value types including null, strings, objects, and arrays
 *
 * @param value - The field value to format
 * @returns Formatted string representation
 *
 * @example
 * ```ts
 * formatConflictValue(null)        // "-"
 * formatConflictValue({ a: 1 })    // "{\n  \"a\": 1\n}"
 * formatConflictValue("text")      // "text"
 * ```
 */
export function formatConflictValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value || '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Check if any conflict field selections have been made
 * Used for form validation before submitting conflict resolution
 *
 * @param selections - Map of model names to selected field sets
 * @returns True if at least one field is selected
 */
export function validateConflictSelections(
  selections: Record<string, Set<string>>
): boolean {
  return Object.values(selections).some((set) => set.size > 0)
}

/**
 * Transform conflict selections from UI state to API payload format
 * Converts Record<modelName, Set<fields>> to Array<{model_name, fields}>
 * Filters out models with no field selections
 *
 * @param selections - Map of model names to selected field sets
 * @returns Array of conflict resolution entries for API
 *
 * @example
 * ```ts
 * const selections = {
 *   'gpt-4': new Set(['description', 'icon']),
 *   'claude-3': new Set()
 * }
 * const payload = transformConflictSelectionsToPayload(selections)
 * // [{ model_name: 'gpt-4', fields: ['description', 'icon'] }]
 * ```
 */
export function transformConflictSelectionsToPayload(
  selections: Record<string, Set<string>>
): { model_name: string; fields: string[] }[] {
  return Object.entries(selections)
    .map(([model_name, fieldSet]) => ({
      model_name,
      fields: Array.from(fieldSet),
    }))
    .filter((item) => item.fields.length > 0)
}
