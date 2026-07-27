import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue'
import i18n from '@/i18n'

let fixtureMode: 'render' | 'event' = 'render'
let renderAttempts = 0

const errorFixture = defineComponent({
  name: 'ErrorBoundaryFixture',
  setup() {
    if (fixtureMode === 'render') {
      renderAttempts += 1
      if (renderAttempts === 1) throw new Error('render failed')
      return () => h('p', 'Recovered')
    }

    return () =>
      h(
        'button',
        {
          onClick: async () => {
            throw new Error('request failed')
          },
        },
        'Submit'
      )
  },
})

describe('AppErrorBoundary', () => {
  it('shows a visible fallback and remounts the failed subtree on retry', async () => {
    fixtureMode = 'render'
    renderAttempts = 0
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(AppErrorBoundary, {
      global: { plugins: [i18n] },
      slots: { default: errorFixture },
    })
    await nextTick()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/"]').exists()).toBe(true)

    await wrapper.get('[data-error-retry]').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Recovered')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(renderAttempts).toBe(2)
    expect(consoleError).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    consoleError.mockRestore()
  })

  it('lets asynchronous event errors propagate without replacing the view', async () => {
    fixtureMode = 'event'
    const globalError = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(AppErrorBoundary, {
      global: {
        plugins: [i18n],
        config: { errorHandler: globalError },
      },
      slots: { default: errorFixture },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Submit')
    expect(globalError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'request failed' }),
      expect.anything(),
      'native event handler'
    )
    expect(consoleError).not.toHaveBeenCalled()

    wrapper.unmount()
    consoleError.mockRestore()
  })
})
