import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import DiscountCard from '@/components/console/dashboard/DiscountCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { ModelShare, UserDiscounts } from '@/composables/useDashboard'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

const discounts: UserDiscounts = {
  global_ratio: 0.88,
  plan_ratio: 0.95,
  effective_ratio: 0.836,
}

/** 500_000 quota units = $1.00, so these sum to $4 actual against $5 list. */
const models: ModelShare[] = [
  {
    model: 'a',
    ratio: 60,
    quota: 1_500_000,
    standard_quota: 2_000_000,
    requests: 10,
    tokens: 100,
  },
  {
    model: 'b',
    ratio: 40,
    quota: 500_000,
    standard_quota: 500_000,
    requests: 5,
    tokens: 50,
  },
]

function render(props: Record<string, unknown> = {}) {
  return mount(DiscountCard, {
    props: { discounts, ...props },
    global: { plugins: [i18n] },
  })
}

describe('DiscountCard', () => {
  it('totals the saving from the per-model list, not from the ratio', () => {
    const wrapper = render({ models })

    // 2.5M standard - 2.0M actual = 0.5M units = $1.00
    expect(wrapper.text()).toContain('$1.00')
    expect(wrapper.text()).toContain('$5.00')
  })

  it('omits the saving panel when there is nothing to total', () => {
    const wrapper = render({ models: [] })

    expect(wrapper.text()).not.toContain('Saved')
  })

  it('omits the saving panel when list price matches what was billed', () => {
    const wrapper = render({
      models: [{ ...models[1]!, quota: 500_000, standard_quota: 500_000 }],
    })

    expect(wrapper.text()).not.toContain('Saved')
  })

  it('labels the personal row as the volume tier, not an account group', () => {
    const wrapper = render()

    expect(wrapper.text()).toContain('Personal discount')
    // plan_ratio 0.95 → an extra 5% off the volume tier.
    expect(wrapper.text()).toContain('Volume-tier extra 5% off')
    expect(wrapper.text()).not.toContain('VIP')
  })

  it('still shows the headline rate', () => {
    expect(render({ models }).text()).toContain('0.836×')
  })
})
