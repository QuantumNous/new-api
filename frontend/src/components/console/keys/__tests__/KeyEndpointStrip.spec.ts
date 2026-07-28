import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import KeyEndpointStrip from '@/components/console/keys/KeyEndpointStrip.vue'
import i18n, { loadMessageDomain } from '@/i18n'

beforeAll(async () => {
  await loadMessageDomain('console')
  i18n.global.locale.value = 'zh-CN'
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mountStrip() {
  return mount(KeyEndpointStrip, {
    attachTo: document.body,
    global: { plugins: [i18n] },
  })
}

describe('KeyEndpointStrip', () => {
  it('renders the four endpoints and copies the selected URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mountStrip()

    expect(wrapper.findAll('code').map((node) => node.text())).toEqual([
      'https://renai.uno',
      'https://vm.renai.uno',
      'https://cf.renai.uno',
      'https://cn.renai.uno',
    ])
    expect(wrapper.text()).toContain(
      i18n.global.t('keys.endpoints.defaultBadge')
    )

    await wrapper
      .get(
        `[aria-label="${i18n.global.t('keys.endpoints.copy', { name: i18n.global.t('keys.endpoints.defaultName') })}"]`
      )
      .trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('https://renai.uno')
    wrapper.unmount()
  })

  it('shows measured latency after a successful probe', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountStrip()

    await wrapper
      .get(
        `[aria-label="${i18n.global.t('keys.endpoints.test', { name: i18n.global.t('keys.endpoints.defaultName') })}"]`
      )
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toMatch(/\d+ ms/)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://renai.uno',
      expect.objectContaining({ method: 'HEAD', mode: 'no-cors' })
    )
    wrapper.unmount()
  })

  it('reports a timeout when a probe exceeds five seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })
    )
    const wrapper = mountStrip()

    await wrapper
      .get(
        `[aria-label="${i18n.global.t('keys.endpoints.test', { name: i18n.global.t('keys.endpoints.defaultName') })}"]`
      )
      .trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()

    expect(wrapper.text()).toContain(i18n.global.t('keys.endpoints.timeout'))
    wrapper.unmount()
  })
})
