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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  isEpayPaymentMethodType,
  isEpaySignedTimestampEnabled,
  isPaymentMethodData,
  setEpaySignedTimestamp,
} from './payment-method-data'

describe('payment method signed timestamp data', () => {
  test('identifies only configured Epay-routed payment types', () => {
    assert.equal(isEpayPaymentMethodType(''), false)
    assert.equal(isEpayPaymentMethodType('stripe'), false)
    assert.equal(isEpayPaymentMethodType('waffo_pancake'), false)
    assert.equal(isEpayPaymentMethodType('nowpayment'), true)
    assert.equal(isEpayPaymentMethodType('custom1'), true)
  })

  test('accepts the optional string field and rejects non-string values', () => {
    assert.equal(
      isPaymentMethodData({
        name: 'NowPayments',
        type: 'nowpayment',
        epay_signed_timestamp: 'true',
      }),
      true
    )
    assert.equal(
      isPaymentMethodData({
        name: 'NowPayments',
        type: 'nowpayment',
        epay_signed_timestamp: true,
      }),
      false
    )
  })

  test('enables only the exact true string', () => {
    assert.equal(
      isEpaySignedTimestampEnabled({
        name: 'NowPayments',
        type: 'nowpayment',
      }),
      false
    )
    assert.equal(
      isEpaySignedTimestampEnabled({
        name: 'NowPayments',
        type: 'nowpayment',
        epay_signed_timestamp: 'TRUE',
      }),
      false
    )
    assert.equal(
      isEpaySignedTimestampEnabled({
        name: 'NowPayments',
        type: 'nowpayment',
        epay_signed_timestamp: 'true',
      }),
      true
    )
  })

  test('serializes true and omits the field when disabled without mutation', () => {
    const source = {
      name: 'NowPayments',
      type: 'nowpayment',
      icon: 'LuWalletCards',
    }
    const enabled = setEpaySignedTimestamp(source, true)
    const disabled = setEpaySignedTimestamp(enabled, false)

    assert.deepEqual(enabled, {
      ...source,
      epay_signed_timestamp: 'true',
    })
    assert.deepEqual(disabled, source)
    assert.deepEqual(source, {
      name: 'NowPayments',
      type: 'nowpayment',
      icon: 'LuWalletCards',
    })
  })

  test('does not enable Epay timestamps for dedicated payment flows', () => {
    assert.deepEqual(
      setEpaySignedTimestamp({ name: 'Stripe', type: 'stripe' }, true),
      { name: 'Stripe', type: 'stripe' }
    )
    assert.deepEqual(
      setEpaySignedTimestamp(
        { name: 'Waffo Pancake', type: 'waffo_pancake' },
        true
      ),
      { name: 'Waffo Pancake', type: 'waffo_pancake' }
    )
  })
})
