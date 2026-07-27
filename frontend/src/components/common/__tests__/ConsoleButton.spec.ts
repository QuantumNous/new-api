import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import ConsoleButton from '@/components/common/ConsoleButton.vue'

describe('ConsoleButton', () => {
  it('forwards native click listeners from callers', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ConsoleButton, {
      attrs: { onClick },
      slots: { default: 'Create' },
    })

    await wrapper.get('button').trigger('click')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not invoke click listeners while disabled', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ConsoleButton, {
      props: { disabled: true },
      attrs: { onClick },
    })

    await wrapper.get('button').trigger('click')

    expect(onClick).not.toHaveBeenCalled()
  })
})
