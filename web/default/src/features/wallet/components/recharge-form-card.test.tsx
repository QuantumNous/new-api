import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TopupInfo } from '../types'
import { RechargeFormCard } from './recharge-form-card'

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
  test('keeps non-Stripe payment entries visible without Stripe preset packages', () => {
    const html = renderToStaticMarkup(
      <RechargeFormCard
        topupInfo={{
          ...topupInfoWithStripe,
          enable_online_topup: true,
          pay_methods: [
            { name: 'Stripe Card', type: 'stripe', min_topup: 1 },
            { name: 'Bank Transfer', type: 'bank', min_topup: 1 },
          ],
        }}
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
    expect(html).toContain('Bank Transfer')
    expect(html).toContain('Waffo Pix')
    expect(html).not.toContain('Stripe Card')
    expect(html).not.toContain('Need company invoice')
  })
})
