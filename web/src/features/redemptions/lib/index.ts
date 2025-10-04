// ============================================================================
// Form Utilities
// ============================================================================
export {
  redemptionFormSchema,
  type RedemptionFormValues,
  REDEMPTION_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformRedemptionToFormDefaults,
} from './redemption-form'

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Check if redemption code is expired
 */
export function isRedemptionExpired(
  expired_time: number,
  status: number
): boolean {
  return status === 1 && expired_time !== 0 && expired_time < Date.now() / 1000
}
