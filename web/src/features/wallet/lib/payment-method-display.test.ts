import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import { getPaymentMethodDisplayName } from './payment-method-display'

describe('getPaymentMethodDisplayName', () => {
  test('normalizes Wechat Pay spelling so i18n can translate it', () => {
    const translate = (key: string) =>
      key === 'WeChat Pay' ? '微信支付' : `missing:${key}`

    assert.equal(
      getPaymentMethodDisplayName('Wechat Pay', translate),
      '微信支付'
    )
  })

  test('returns original custom payment name when no translation exists', () => {
    const translate = (key: string) => key

    assert.equal(getPaymentMethodDisplayName('自定义', translate), '自定义')
  })
})
