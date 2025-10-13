import { z } from 'zod'
import { type Vendor, type VendorFormData } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const vendorFormSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: z.boolean(),
})

export type VendorFormValues = z.infer<typeof vendorFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const VENDOR_FORM_DEFAULT_VALUES: VendorFormValues = {
  name: '',
  description: '',
  icon: '',
  status: true,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformVendorFormDataToPayload(
  data: VendorFormValues
): VendorFormData {
  return {
    name: data.name,
    description: data.description || '',
    icon: data.icon || '',
    status: data.status ? 1 : 0,
  }
}

/**
 * Transform API vendor data to form defaults
 */
export function transformVendorToFormDefaults(
  vendor: Vendor
): VendorFormValues {
  return {
    name: vendor.name,
    description: vendor.description || '',
    icon: vendor.icon || '',
    status: vendor.status === 1,
  }
}
