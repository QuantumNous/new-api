import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ConsoleCard from '@/components/common/ConsoleCard.vue'

describe('ConsoleCard hand-drawn contract', () => {
  it('uses the default pencil surface without changing its public slots', () => {
    const wrapper = mount(ConsoleCard, {
      props: { title: 'Usage' },
      slots: { default: '<p class="body-copy">Body</p>' },
    })

    expect(wrapper.attributes('data-handdrawn')).toBe('surface')
    expect(wrapper.classes()).toContain('pencil-surface')
    expect(wrapper.get('.body-copy').text()).toBe('Body')
  })

  it('strengthens sketch cards with an independent decorative stamp', () => {
    const wrapper = mount(ConsoleCard, {
      props: { variant: 'sketch' },
    })

    expect(wrapper.attributes('data-handdrawn')).toBe('surface-strong')
    expect(wrapper.classes()).toContain('pencil-surface-strong')
    expect(wrapper.get('.stamp-watermark-art').attributes('aria-hidden')).toBe(
      'true'
    )
  })

  it('keeps the ink variant outside the light pencil surface treatment', () => {
    const wrapper = mount(ConsoleCard, { props: { variant: 'ink' } })

    expect(wrapper.attributes('data-handdrawn')).toBeUndefined()
    expect(wrapper.classes()).toContain('no-handdrawn')
    expect(wrapper.classes()).not.toContain('pencil-surface')
  })
})
