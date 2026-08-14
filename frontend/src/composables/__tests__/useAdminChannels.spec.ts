import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useAdminChannels } from '@/composables/useAdminChannels'
import type { AdminChannel, AdminChannelPage } from '@/types/console'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/api/console', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ readOnly: { value: false } }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

function makeChannel(): AdminChannel {
  return {
    id: 7,
    name: 'test-channel',
    type: 1,
    supplier: 'OpenAI',
    status: 1,
    priority: 0,
    weight: 0,
    capacity_used: 0,
    capacity_total: 20,
    channel_ratio: 1,
    upstream_ratio: 1,
    used_quota: 0,
    balance: 0,
    response_time: 0,
    test_time: 0,
    base_url: '',
    models: 'gpt-4o',
    model_mapping: '',
  }
}

const pageResponse = (channel: AdminChannel): AdminChannelPage => ({
  items: [channel],
  total: 1,
  page: 1,
  page_size: 20,
  type_counts: {},
})

async function renderComposable(channel: AdminChannel) {
  let state: ReturnType<typeof useAdminChannels> | undefined
  vi.mocked(api.get).mockResolvedValueOnce(pageResponse(channel))
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useAdminChannels()
        return () => null
      },
    })
  )
  await flushPromises()
  if (!state) throw new Error('useAdminChannels did not initialize')
  return { state, wrapper }
}

describe('useAdminChannels channel testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the channel row immediately after a successful test', async () => {
    const channel = makeChannel()
    const { state, wrapper } = await renderComposable(channel)
    vi.mocked(api.get).mockResolvedValueOnce({
      time: 0.261,
      response_time: 261,
      test_time: 1_725_000_000,
    })

    await expect(
      state.testChannelModel(channel, 'gpt-4o')
    ).resolves.toMatchObject({
      ok: true,
      timeMs: 261,
      responseTime: 261,
      testTime: 1_725_000_000,
    })
    expect(state.rows.value[0]).toMatchObject({
      response_time: 261,
      test_time: 1_725_000_000,
    })
    wrapper.unmount()
  })

  it('updates the channel row from timing data on an upstream failure', async () => {
    const channel = makeChannel()
    const { state, wrapper } = await renderComposable(channel)
    vi.mocked(api.get).mockRejectedValueOnce(
      new ApiError('upstream failed', {
        status: 200,
        business: true,
        data: {
          time: 0.523,
          response_time: 523,
          test_time: 1_725_000_001,
        },
      })
    )

    await expect(
      state.testChannelModel(channel, 'gpt-4o')
    ).resolves.toMatchObject({
      ok: false,
      message: 'upstream failed',
      timeMs: 523,
      responseTime: 523,
      testTime: 1_725_000_001,
    })
    expect(state.rows.value[0]).toMatchObject({
      response_time: 523,
      test_time: 1_725_000_001,
    })
    wrapper.unmount()
  })
})
