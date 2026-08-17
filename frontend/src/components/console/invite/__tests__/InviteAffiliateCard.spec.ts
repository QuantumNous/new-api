import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import InviteAffiliateCard from '@/components/console/invite/InviteAffiliateCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('en')
})

describe('InviteAffiliateCard', () => {
  it('shows the effective rebate rate without a fake QR code', () => {
    const wrapper = mount(InviteAffiliateCard, {
      props: {
        code: 'INVITE01',
        inviteLink: 'https://example.test/auth/sign-up?aff=INVITE01',
        ratePercent: 10,
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).toContain('10%')
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
  })
})
