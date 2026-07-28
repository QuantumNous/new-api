import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import KeyEndpointStrip from '@/components/console/keys/KeyEndpointStrip.vue'
import { runEndpointProbe } from '@/components/console/keys/endpointProbe'
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

  it('simulates endpoint latency without network access in mock mode', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountStrip()

    await wrapper
      .get(
        `[aria-label="${i18n.global.t('keys.endpoints.test', { name: i18n.global.t('keys.endpoints.defaultName') })}"]`
      )
      .trigger('click')
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()

    expect(wrapper.text()).toMatch(/\d+ ms/)
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('uses a cancellable HEAD request only in explicit HTTP mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(
      runEndpointProbe('default', 'https://renai.uno', controller.signal, false)
    ).resolves.toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://renai.uno',
      expect.objectContaining({ method: 'HEAD', mode: 'no-cors' })
    )
  })

  it('cancels an in-flight HTTP probe', async () => {
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
    const controller = new AbortController()
    const pending = runEndpointProbe(
      'default',
      'https://renai.uno',
      controller.signal,
      false
    )

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
