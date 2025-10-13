import { z } from 'zod'
import { type Model, type ModelFormData } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const modelFormSchema = z.object({
  model_name: z.string().min(1, 'Model name is required'),
  name_rule: z.number().min(0).max(3),
  description: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()),
  vendor_id: z.number().optional(),
  endpoints: z.string().optional(),
  sync_official: z.boolean(),
  status: z.boolean(),
})

export type ModelFormValues = z.infer<typeof modelFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const MODEL_FORM_DEFAULT_VALUES: ModelFormValues = {
  model_name: '',
  name_rule: 0, // exact match by default
  description: '',
  icon: '',
  tags: [],
  vendor_id: undefined,
  endpoints: '',
  sync_official: true,
  status: true,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: ModelFormValues
): ModelFormData {
  return {
    model_name: data.model_name,
    name_rule: data.name_rule,
    description: data.description || '',
    icon: data.icon || '',
    tags: data.tags.join(','),
    vendor_id: data.vendor_id,
    endpoints: data.endpoints || '',
    status: data.status ? 1 : 0,
    sync_official: data.sync_official ? 1 : 0,
  }
}

/**
 * Transform API model data to form defaults
 */
export function transformModelToFormDefaults(model: Model): ModelFormValues {
  return {
    model_name: model.model_name,
    name_rule: model.name_rule,
    description: model.description || '',
    icon: model.icon || '',
    tags: model.tags ? model.tags.split(',').filter(Boolean) : [],
    vendor_id: model.vendor_id || undefined,
    endpoints: model.endpoints || '',
    sync_official: (model.sync_official ?? 1) === 1,
    status: model.status === 1,
  }
}

/**
 * Validate and format endpoints JSON
 */
export function validateEndpointsJSON(value: string): boolean {
  if (!value || value.trim() === '') return true
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

/**
 * Format endpoints for display
 */
export function formatEndpoints(
  endpoints: string
): { key: string; path: string; method: string }[] {
  if (!endpoints) return []
  try {
    const parsed = JSON.parse(endpoints)
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.entries(parsed).map(([key, value]: [string, any]) => ({
      key,
      path: value?.path || '',
      method: value?.method || '',
    }))
  } catch {
    return []
  }
}
