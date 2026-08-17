import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import TicketThreadMessage from '@/components/console/tickets/TicketThreadMessage.vue'
import type { TicketMessage } from '@/types/console'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      tickets: { detail: { dept: { support: '客服' } }, admin: {} },
    },
  },
})

const supportMessage: TicketMessage = {
  id: 1,
  role: 'support',
  content: 'Support reply',
  images: [],
  created: 1_700_000_000,
}

describe('TicketThreadMessage', () => {
  it('places the current viewer messages on the right', () => {
    const supportView = mount(TicketThreadMessage, {
      props: { message: supportMessage, viewer: 'support' },
      global: { plugins: [i18n] },
    })
    const userView = mount(TicketThreadMessage, {
      props: { message: supportMessage, viewer: 'user' },
      global: { plugins: [i18n] },
    })

    expect(supportView.classes()).toContain('flex-row-reverse')
    expect(userView.classes()).not.toContain('flex-row-reverse')
    expect(userView.text()).toContain('客服')
  })

  it('hides support departments from the user view', () => {
    const view = mount(TicketThreadMessage, {
      props: {
        message: { ...supportMessage, department: 'tech' },
        viewer: 'user',
      },
      global: { plugins: [i18n] },
    })

    expect(view.text()).toContain('客服')
    expect(view.text()).not.toContain('技术')
  })
})
