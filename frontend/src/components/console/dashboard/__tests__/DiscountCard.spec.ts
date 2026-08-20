import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import DiscountCard from '@/components/console/dashboard/DiscountCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { UserDiscounts } from '@/composables/useDashboard'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

const discounts: UserDiscounts = {
  global_ratio: 0.88,
  plan_ratio: 0.95,
  effective_ratio: 0.836,
}

function render(props: Record<string, unknown> = {}) {
  return mount(DiscountCard, {
    props: { discounts, ...props },
    global: { plugins: [i18n] },
  })
}

describe('DiscountCard', () => {
  it('shows an explicit unavailable state without traffic price claims', () => {
    const wrapper = render({ discounts: null })

    expect(wrapper.text()).toContain('Discount details are not available')
    expect(wrapper.text()).not.toContain('Saved')
    expect(wrapper.text()).not.toContain('At list price')
  })

  it('labels the personal row as the volume tier, not an account group', () => {
    const wrapper = render()

    expect(wrapper.text()).toContain('Personal discount')
    // plan_ratio 0.95 → an extra 5% off the volume tier.
    expect(wrapper.text()).toContain('Volume-tier extra 5% off')
    expect(wrapper.text()).not.toContain('VIP')
  })

  it('still shows the headline rate', () => {
    expect(render().text()).toContain('0.836×')
  })
})
