import { z } from 'zod'
import { type PrefillGroup, type PrefillGroupFormData } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const prefillGroupFormSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  type: z.enum(['model', 'tag', 'endpoint']),
  description: z.string().optional(),
  items: z.union([z.string(), z.array(z.string())]),
})

export type PrefillGroupFormValues = z.infer<typeof prefillGroupFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const PREFILL_GROUP_FORM_DEFAULT_VALUES: PrefillGroupFormValues = {
  name: '',
  type: 'tag',
  description: '',
  items: [],
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformPrefillGroupFormDataToPayload(
  data: PrefillGroupFormValues
): PrefillGroupFormData {
  return {
    name: data.name,
    type: data.type,
    description: data.description || '',
    items: data.type === 'endpoint' ? (data.items as string) : data.items,
  }
}

/**
 * Transform API prefill group data to form defaults
 */
export function transformPrefillGroupToFormDefaults(
  group: PrefillGroup
): PrefillGroupFormValues {
  let items: string | string[]

  try {
    if (group.type === 'endpoint') {
      // Keep as string for endpoint type
      items =
        typeof group.items === 'string'
          ? group.items
          : JSON.stringify(group.items, null, 2)
    } else {
      // Convert to array for model/tag types
      items = Array.isArray(group.items)
        ? group.items
        : typeof group.items === 'string'
          ? JSON.parse(group.items)
          : []
    }
  } catch {
    items = group.type === 'endpoint' ? '' : []
  }

  return {
    name: group.name,
    type: group.type,
    description: group.description || '',
    items,
  }
}

/**
 * Validate endpoints JSON for prefill groups
 */
export function validatePrefillEndpointsJSON(value: string): boolean {
  if (!value || value.trim() === '') return true
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}
