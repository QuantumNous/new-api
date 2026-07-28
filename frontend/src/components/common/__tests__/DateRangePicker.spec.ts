import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DateRangePicker from '@/components/common/DateRangePicker.vue'
import i18n from '@/i18n'

describe('DateRangePicker keyboard model', () => {
  it('uses roving focus and selects dates with the keyboard', async () => {
    const wrapper = mount(DateRangePicker, {
      attachTo: document.body,
      props: { start: '2026-07-15', end: '' },
      global: { plugins: [i18n] },
    })

    const trigger = wrapper.get('button[aria-haspopup="dialog"]')
    expect(trigger.attributes('data-handdrawn')).toBe('control')
    expect(trigger.find('button').exists()).toBe(false)
    expect(
      wrapper.get(`button[aria-label="${i18n.global.t('logs.clear')}"]`).element
        .tagName
    ).toBe('BUTTON')

    await trigger.trigger('click')
    await nextTick()
    expect(wrapper.get('[role="dialog"]').attributes('data-handdrawn')).toBe(
      'menu'
    )
    expect(
      wrapper.get('[data-date-key="2026-07-15"] span').classes()
    ).not.toContain('pencil-control')
    const active = document.activeElement as HTMLButtonElement
    expect(active.dataset.dateKey).toBe('2026-07-15')

    await active.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )
    await nextTick()
    expect((document.activeElement as HTMLElement).dataset.dateKey).toBe(
      '2026-07-16'
    )

    await (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    expect(wrapper.emitted('update:end')?.at(-1)).toEqual(['2026-07-16'])
  })
})
