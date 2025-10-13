/**
 * Format sync result message
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

/**
 * Format conflict field value for display
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
 * Check if conflict selections are valid
 */
export function validateConflictSelections(
  selections: Record<string, Set<string>>
): boolean {
  return Object.values(selections).some((set) => set.size > 0)
}

/**
 * Transform conflict selections to API payload
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
