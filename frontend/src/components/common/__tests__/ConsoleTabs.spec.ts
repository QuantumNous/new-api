import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ConsoleTabs from '@/components/common/ConsoleTabs.vue'

const items = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Details' },
  { key: 'history', label: 'History' },
]

describe('ConsoleTabs', () => {
  it('associates every tab with the controlled panel', () => {
    const wrapper = mount(ConsoleTabs, {
      props: {
        modelValue: 'overview',
        items,
        panelId: 'account-panel',
      },
    })

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.attributes('aria-controls'))).toEqual([
      'account-panel',
      'account-panel',
      'account-panel',
    ])
    expect(tabs.map((tab) => tab.attributes('id'))).toEqual([
      'account-panel-tab-overview',
      'account-panel-tab-details',
      'account-panel-tab-history',
    ])
  })

  it('supports wrapping arrows plus Home and End', async () => {
    const wrapper = mount(ConsoleTabs, {
      attachTo: document.body,
      props: {
        modelValue: 'overview',
        items,
        panelId: 'account-panel',
      },
    })
    const tabs = wrapper.findAll('[role="tab"]')

    await tabs[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['history'])
    expect(document.activeElement).toBe(tabs[2]!.element)

    await tabs[2]!.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['overview'])

    await tabs[0]!.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['history'])
    expect(document.activeElement).toBe(tabs[2]!.element)

    wrapper.unmount()
  })
})
