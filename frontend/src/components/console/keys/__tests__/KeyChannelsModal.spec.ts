import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import KeyChannelsModal from '@/components/console/keys/KeyChannelsModal.vue'
import i18n, { loadMessageDomain } from '@/i18n'
import type { MyChannel, TokenSummary } from '@/types/console'

function token(id: number, channel: string): TokenSummary {
  return {
    id,
    name: `token-${id}`,
    key_preview: 'sk-preview',
    type: 'manual',
    status: 1,
    used_quota: 0,
    remain_quota: 0,
    unlimited: true,
    model_limits: [],
    ip_limits: [],
    rate_limit: 0,
    load_balance: false,
    channels: [{ name: channel, enabled: true }],
    expired_time: -1,
    created_time: 1,
  }
}

function marketChannel(id: number, merchantName: string): MyChannel {
  return {
    id,
    listingId: id,
    merchantId: id,
    merchantName,
    title: merchantName,
    supportedModels: [],
    status: 'active',
    addedAt: 1,
  }
}

beforeAll(() => loadMessageDomain('console'))
afterEach(() => vi.restoreAllMocks())

describe('KeyChannelsModal', () => {
  it('refreshes its working copy and ignores stale candidates when token changes', async () => {
    let resolveOld: (value: { channels: MyChannel[] }) => void = () => undefined
    const oldRequest = new Promise<{ channels: MyChannel[] }>((resolve) => {
      resolveOld = resolve
    })
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(oldRequest as never)
      .mockResolvedValueOnce({
        channels: [marketChannel(2, 'New vendor')],
      } as never)

    const wrapper = mount(KeyChannelsModal, {
      props: { open: false, token: token(1, 'Old selected') },
      global: { plugins: [i18n] },
    })

    await wrapper.setProps({ open: true })
    await wrapper.setProps({ token: token(2, 'New selected') })
    await flushPromises()
    resolveOld({ channels: [marketChannel(1, 'Old vendor')] })
    await flushPromises()

    const text = document.body.textContent ?? ''
    expect(text).toContain('New selected')
    expect(text).toContain('New vendor')
    expect(text).not.toContain('Old selected')
    expect(text).not.toContain('Old vendor')

    wrapper.unmount()
  })
})
