import { z } from 'zod'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { REDEMPTION_VALIDATION, ERROR_MESSAGES } from '../constants'
import { type RedemptionFormData, type Redemption } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const redemptionFormSchema = z.object({
  name: z
    .string()
    .min(
      REDEMPTION_VALIDATION.NAME_MIN_LENGTH,
      ERROR_MESSAGES.NAME_LENGTH_INVALID
    )
    .max(
      REDEMPTION_VALIDATION.NAME_MAX_LENGTH,
      ERROR_MESSAGES.NAME_LENGTH_INVALID
    ),
  quota_dollars: z.number().min(0, 'Quota must be a positive number'),
  expired_time: z.date().optional(),
  count: z
    .number()
    .min(REDEMPTION_VALIDATION.COUNT_MIN, ERROR_MESSAGES.COUNT_INVALID)
    .max(REDEMPTION_VALIDATION.COUNT_MAX, ERROR_MESSAGES.COUNT_INVALID)
    .optional(),
})

export type RedemptionFormValues = z.infer<typeof redemptionFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const REDEMPTION_FORM_DEFAULT_VALUES: RedemptionFormValues = {
  name: '',
  quota_dollars: 10,
  expired_time: undefined,
  count: 1,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: RedemptionFormValues
): RedemptionFormData {
  return {
    name: data.name,
    quota: parseQuotaFromDollars(data.quota_dollars),
    expired_time: data.expired_time
      ? Math.floor(data.expired_time.getTime() / 1000)
      : 0,
    count: data.count || 1,
  }
}

/**
 * Transform redemption data to form defaults
 */
export function transformRedemptionToFormDefaults(
  redemption: Redemption
): RedemptionFormValues {
  return {
    name: redemption.name,
    quota_dollars: quotaUnitsToDollars(redemption.quota),
    expired_time:
      redemption.expired_time > 0
        ? new Date(redemption.expired_time * 1000)
        : undefined,
    count: 1,
  }
}
