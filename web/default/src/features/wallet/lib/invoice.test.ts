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
import { describe, expect, test } from 'bun:test'
import {
  EMPTY_INVOICE_PROFILE,
  normalizeInvoiceProfile,
  validateInvoiceProfile,
} from './invoice'

describe('invoice profile helpers', () => {
  test('does not require a billing email from the invoice form', () => {
    expect(
      validateInvoiceProfile({
        ...EMPTY_INVOICE_PROFILE,
        company_name: 'Acme Inc',
        country: 'US',
        address_line1: '1 Main St',
      })
    ).toBeNull()
  })

  test('drops billing email entered by older clients', () => {
    expect(
      normalizeInvoiceProfile({
        ...EMPTY_INVOICE_PROFILE,
        company_name: 'Acme Inc',
        billing_email: ' request@example.com ',
        country: ' us ',
        address_line1: '1 Main St',
      }).billing_email
    ).toBeUndefined()
  })
})
