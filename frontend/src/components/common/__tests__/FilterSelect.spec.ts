import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import FilterSelect from '@/components/common/FilterSelect.vue'
import MultiFilterSelect from '@/components/common/MultiFilterSelect.vue'
import i18n from '@/i18n'

const options = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready' },
]

describe('hand-drawn filter controls', () => {
  it('marks the single-select trigger and menu while preserving selection', async () => {
    const wrapper = mount(FilterSelect, {
      props: { modelValue: 'all', options, label: 'Status' },
      global: { plugins: [i18n] },
    })

    const trigger = wrapper.get('[role="combobox"]')
    expect(trigger.attributes('data-handdrawn')).toBe('control')
    await trigger.trigger('click')
    await nextTick()

    expect(wrapper.get('[role="listbox"]').attributes('data-handdrawn')).toBe(
      'menu'
    )
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['ready'])
  })

  it('marks the multi-select trigger and menu without changing its ARIA model', async () => {
    const wrapper = mount(MultiFilterSelect, {
      props: {
        modelValue: ['ready'],
        options,
        label: 'Status',
        placeholder: 'All statuses',
      },
      global: { plugins: [i18n] },
    })

    const trigger = wrapper.get('[role="combobox"]')
    await trigger.trigger('click')
    await nextTick()

    const menu = wrapper.get('[role="listbox"]')
    expect(trigger.attributes('data-handdrawn')).toBe('control')
    expect(menu.attributes('data-handdrawn')).toBe('menu')
    expect(menu.attributes('aria-multiselectable')).toBe('true')
  })
})
