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
import type { InvoiceProfile, PaymentRequest } from '../types'
import type { StripeCheckoutCurrency } from './stripe-currency'

const DEFAULT_STRIPE_CHECKOUT_CURRENCY: StripeCheckoutCurrency = 'USD'

interface StripeRedirectUrls {
  success_url: string
  cancel_url: string
}

interface StripeGaIdentifiers {
  ga_client_id?: string
  ga_session_id?: string
}

interface BuildStripePaymentRequestParams {
  amount: number
  redirectUrls: StripeRedirectUrls
  gaIdentifiers?: StripeGaIdentifiers
  stripeCurrency?: StripeCheckoutCurrency
  saveCard?: boolean
  invoiceRequested?: boolean
  invoiceProfile?: InvoiceProfile
  /** Ask the server for an embedded Checkout session (client_secret) instead of a hosted link */
  preferEmbeddedCheckout?: boolean
}

export function buildStripePaymentRequest({
  amount,
  redirectUrls,
  gaIdentifiers,
  stripeCurrency,
  saveCard,
  invoiceRequested,
  invoiceProfile,
  preferEmbeddedCheckout,
}: BuildStripePaymentRequestParams): PaymentRequest {
  const request: PaymentRequest = {
    amount,
    payment_method: 'stripe',
    stripe_currency: stripeCurrency ?? DEFAULT_STRIPE_CHECKOUT_CURRENCY,
    ...gaIdentifiers,
    ...redirectUrls,
  }

  if (saveCard) {
    request.save_card = true
  }

  if (preferEmbeddedCheckout) {
    request.ui_mode = 'embedded'
  }

  if (invoiceRequested && invoiceProfile) {
    request.invoice_requested = true
    request.invoice_profile = invoiceProfile
  }

  return request
}
