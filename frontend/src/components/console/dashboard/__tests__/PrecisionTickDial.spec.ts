import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PrecisionTickDial from '@/components/console/dashboard/PrecisionTickDial.vue'

describe('PrecisionTickDial', () => {
  it('renders a standby unknown state with 20 ticks when percent is null', () => {
    const wrapper = mount(PrecisionTickDial, {
      props: {
        percent: null,
        color: 'var(--glow)',
        size: 38,
      },
    })

    expect(wrapper.attributes('data-success-rate-state')).toBe('unknown')
    expect(wrapper.findAll('line')).toHaveLength(20)
    expect(wrapper.findAll('.tick-standby')).toHaveLength(20)
    expect(wrapper.findAll('.tick-active')).toHaveLength(0)
    expect(wrapper.find('svg').attributes('width')).toBe('38')
    expect(wrapper.find('svg').attributes('height')).toBe('38')
  })

  it('renders partially active ticks when percent is provided', () => {
    const wrapper = mount(PrecisionTickDial, {
      props: {
        percent: 50,
        color: 'var(--accent)',
        size: 38,
        tickCount: 20,
      },
    })

    expect(wrapper.attributes('data-success-rate-state')).toBe('value')
    expect(wrapper.findAll('.tick-active')).toHaveLength(10)
    expect(wrapper.findAll('.tick-inactive')).toHaveLength(10)
    expect(wrapper.findAll('.tick-standby')).toHaveLength(0)
  })

  it('activates all ticks for 100 percent', () => {
    const wrapper = mount(PrecisionTickDial, {
      props: {
        percent: 100,
        color: 'var(--glow)',
        size: 38,
      },
    })

    expect(wrapper.attributes('data-success-rate-state')).toBe('value')
    expect(wrapper.findAll('.tick-active')).toHaveLength(20)
    expect(wrapper.findAll('.tick-inactive')).toHaveLength(0)
  })
})
