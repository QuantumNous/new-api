import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ConsoleModal from '@/components/common/ConsoleModal.vue'

describe('ConsoleModal', () => {
  it('has an accessible name, traps initial focus and restores the trigger', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    const wrapper = mount(ConsoleModal, {
      attachTo: document.body,
      props: { open: false, title: 'Delete token' },
      slots: { default: '<button class="confirm">Confirm</button>' },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.activeElement?.classList.contains('confirm')).toBe(true)

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('only lets the topmost dialog handle Escape', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    const host = defineComponent({
      components: { ConsoleModal },
      setup() {
        const outerOpen = ref(true)
        const innerOpen = ref(true)
        return { outerOpen, innerOpen }
      },
      template: `
        <ConsoleModal :open="outerOpen" title="Outer" @close="outerOpen = false">
          <button class="outer-action">Outer action</button>
        </ConsoleModal>
        <ConsoleModal :open="innerOpen" title="Inner" @close="innerOpen = false">
          <button class="inner-action">Inner action</button>
        </ConsoleModal>
      `,
    })
    const wrapper = mount(host, { attachTo: document.body })
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.vm.innerOpen).toBe(false)
    expect(wrapper.vm.outerOpen).toBe(true)
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(document.body.style.overflow).toBe('hidden')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.vm.outerOpen).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)

    wrapper.unmount()
    trigger.remove()
  })

  it('keeps the body locked when stacked modals close out of order', async () => {
    document.body.style.overflow = ''
    const first = mount(ConsoleModal, {
      attachTo: document.body,
      props: { open: false, title: 'first' },
    })
    const second = mount(ConsoleModal, {
      attachTo: document.body,
      props: { open: false, title: 'second' },
    })

    await first.setProps({ open: true })
    await second.setProps({ open: true })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    // Closing the *older* modal first must not unlock while the newer one is
    // still open, and must not leave a stale "hidden" behind afterwards.
    await first.setProps({ open: false })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    await second.setProps({ open: false })
    await nextTick()
    expect(document.body.style.overflow).toBe('')

    first.unmount()
    second.unmount()
  })

  it('releases its scroll lock when unmounted while open', async () => {
    document.body.style.overflow = ''
    const wrapper = mount(ConsoleModal, {
      attachTo: document.body,
      props: { open: false, title: 'unmount-while-open' },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
