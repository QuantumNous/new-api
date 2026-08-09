import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import InviteAffiliateCard from '@/components/console/invite/InviteAffiliateCard.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('en')
})

describe('InviteAffiliateCard', () => {
  it('shows the fixed registration reward without a fake QR or rebate rate', () => {
    const wrapper = mount(InviteAffiliateCard, {
      props: {
        code: 'INVITE01',
        inviteLink: 'https://example.test/auth/sign-up?aff=INVITE01',
        rewardPerInvite: 500_000,
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).toContain('$1.00')
    expect(wrapper.text()).not.toContain('%')
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
  })
})
