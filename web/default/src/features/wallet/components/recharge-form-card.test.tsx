import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RechargeFormCard } from './recharge-form-card'
import type { TopupInfo } from '../types'

const topupInfoWithStripe: TopupInfo = {
  enable_online_topup: false,
  enable_stripe_topup: true,
  pay_methods: [{ name: 'Stripe Card', type: 'stripe', min_topup: 1 }],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
  bonus: {},
  enable_redemption: false,
}

describe('RechargeFormCard', () => {
  test('does not render package-backed payment entries without preset packages', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={topupInfoWithStripe}
        presetAmounts={[]}
        selectedPreset={null}
        onSelectPreset={() => undefined}
        topupAmount={0}
        onPaymentMethodSelect={() => undefined}
        paymentLoading={null}
        redemptionCode=''
        onRedemptionCodeChange={() => undefined}
        onRedeem={() => undefined}
        redeeming={false}
        enableWaffoTopup
        waffoPayMethods={[{ name: 'Waffo Pix' }]}
        onWaffoMethodSelect={() => undefined}
      />
    )

    expect(html).toContain('No top-up packages available')
    expect(html).not.toContain('Stripe Card')
    expect(html).not.toContain('Waffo Pix')
    expect(html).not.toContain('Need company invoice')
  })
})
