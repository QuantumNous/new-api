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
import { buildStripePaymentRequest } from './stripe-payment-request'

const redirectUrls = {
  success_url: 'https://app.example.com/wallet?show_history=true',
  cancel_url: 'https://app.example.com/wallet',
}

describe('buildStripePaymentRequest', () => {
  test('sends USD as the default Stripe checkout currency', () => {
    const request = buildStripePaymentRequest({
      amount: 20,
      redirectUrls,
      gaIdentifiers: {
        ga_client_id: 'client-1',
        ga_session_id: 'session-1',
      },
    })

    expect(request).toEqual({
      amount: 20,
      payment_method: 'stripe',
      stripe_currency: 'USD',
      ga_client_id: 'client-1',
      ga_session_id: 'session-1',
      ...redirectUrls,
    })
  })

  test('uses the explicit Stripe currency when provided', () => {
    const request = buildStripePaymentRequest({
      amount: 200,
      stripeCurrency: 'JPY',
      redirectUrls,
    })

    expect(request.stripe_currency).toBe('JPY')
  })

  test('keeps promo card binding fields with the default currency', () => {
    const request = buildStripePaymentRequest({
      amount: 200,
      saveCard: true,
      redirectUrls,
    })

    expect(request.save_card).toBe(true)
    expect(request.stripe_currency).toBe('USD')
  })
})
