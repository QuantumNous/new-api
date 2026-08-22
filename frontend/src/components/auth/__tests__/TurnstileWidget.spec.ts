import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import TurnstileWidget from '../TurnstileWidget.vue'

describe('TurnstileWidget', () => {
  beforeEach(() => {
    window.turnstile = {
      render: vi.fn((_container, options) => {
        options.callback?.('verified-token')
        return 'widget-1'
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    }
  })

  it('emits a verified token from the explicit widget', async () => {
    const wrapper = mount(TurnstileWidget, {
      props: { siteKey: 'site-key' },
      global: { plugins: [i18n] },
    })
    await vi.waitFor(() => {
      expect(wrapper.emitted('verified')).toEqual([['verified-token']])
    })
    wrapper.unmount()
  })
})
