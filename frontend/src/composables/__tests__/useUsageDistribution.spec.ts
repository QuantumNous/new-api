import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { useUsageDistribution } from '@/composables/useUsageDistribution'
import i18n from '@/i18n'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useUsageDistribution', () => {
  it('loads the real dashboard distribution contract with the client offset', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue([] as never)
    let state: ReturnType<typeof useUsageDistribution> | null = null
    const wrapper = mount(
      defineComponent({
        setup() {
          state = useUsageDistribution()
          return () => null
        },
      }),
      { global: { plugins: [i18n] } }
    )

    await (state as unknown as ReturnType<typeof useUsageDistribution>).load()

    expect(get).toHaveBeenCalledWith('/api/next/dashboard/distribution', {
      tz_offset: expect.any(String),
    })
    wrapper.unmount()
  })
})
