import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import BalanceCard from '@/components/console/dashboard/BalanceCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('en')
})

beforeEach(() => {
  localStorage.clear()
})

describe('BalanceCard', () => {
  it('does not relabel today spend as monthly spend', () => {
    const wrapper = mount(BalanceCard, {
      props: { quota: 5_000_000, todayQuota: 500_000 },
      global: { plugins: [i18n] },
    })

    const monthTile = wrapper.findAll('[data-balance-spend-tile]')[0]!
    expect(monthTile.text()).toContain("This month's spend")
    expect(monthTile.text()).toContain('--')
    expect(monthTile.text()).not.toContain('$1.00')
  })

  it('renders the supplied calendar-month spend', () => {
    const wrapper = mount(BalanceCard, {
      props: { quota: 5_000_000, monthQuota: 1_500_000 },
      global: { plugins: [i18n] },
    })

    expect(wrapper.findAll('[data-balance-spend-tile]')[0]!.text()).toContain(
      '$3.00'
    )
  })
})
