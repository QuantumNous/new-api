import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SegmentedToggle from '@/components/common/SegmentedToggle.vue'

const options = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
]

describe('SegmentedToggle', () => {
  it('exposes a single-selection radio contract', () => {
    const wrapper = mount(SegmentedToggle, {
      props: { modelValue: 'second', options, label: 'View mode' },
    })

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(
      'View mode'
    )
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(radios.map((radio) => radio.attributes('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ])
  })

  it('selects and focuses options with arrows, Home and End', async () => {
    const wrapper = mount(SegmentedToggle, {
      attachTo: document.body,
      props: { modelValue: 'first', options, label: 'View mode' },
    })
    const radios = wrapper.findAll('[role="radio"]')

    await radios[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['third'])
    expect(document.activeElement).toBe(radios[2]!.element)

    await radios[2]!.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['first'])
    expect(document.activeElement).toBe(radios[0]!.element)

    await radios[0]!.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['third'])
    expect(document.activeElement).toBe(radios[2]!.element)

    wrapper.unmount()
  })
})
