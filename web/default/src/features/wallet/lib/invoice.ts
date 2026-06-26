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
import type { InvoiceProfile } from '../types'

export const EMPTY_INVOICE_PROFILE: InvoiceProfile = {
  company_name: '',
  tax_id_type: '',
  tax_id: '',
  country: '',
  state: '',
  city: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  phone: '',
}

export function normalizeInvoiceProfile(
  profile: InvoiceProfile
): InvoiceProfile {
  return {
    company_name: profile.company_name.trim(),
    tax_id_type: profile.tax_id_type?.trim().toLowerCase(),
    tax_id: profile.tax_id?.trim(),
    country: profile.country.trim().toUpperCase(),
    state: profile.state?.trim(),
    city: profile.city?.trim(),
    address_line1: profile.address_line1.trim(),
    address_line2: profile.address_line2?.trim(),
    postal_code: profile.postal_code?.trim(),
    phone: profile.phone?.trim(),
  }
}

export function validateInvoiceProfile(profile: InvoiceProfile): string | null {
  const normalized = normalizeInvoiceProfile(profile)
  if (!normalized.company_name) return 'Company name is required'
  if (!normalized.country) return 'Country is required'
  if (!normalized.address_line1) return 'Address is required'
  return null
}
