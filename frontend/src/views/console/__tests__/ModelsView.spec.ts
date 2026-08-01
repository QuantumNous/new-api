import { flushPromises, mount } from '@vue/test-utils'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { api } from '@/api/console'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { MarketModel } from '@/types/console'
import ModelsView from '@/views/console/ModelsView.vue'

const tieredModel: MarketModel = {
  id: 1,
  name: 'gpt-4o',
  vendor: 'OpenAI',
  type: 'chat',
  billing: 'tiered',
  price: {
    input: 2.5,
    output: 10,
    cache_read: 1.25,
    tiers: [
      { label: '0-128K', input: 2.5, output: 10 },
      { label: '128K+', input: 5, output: 15 },
    ],
  },
  context: 128_000,
  tagline: '全能旗舰多模态模型，均衡的速度与质量。',
  latency: 1.78,
  tps: 62.4,
  health: 98,
  channels: ['平台', '云枢智算'],
}

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    models: [tieredModel],
    channels: tieredModel.channels,
    vendors: [tieredModel.vendor],
  })
  window.localStorage.setItem('ren2hub_models_view', 'grid')
})

afterEach(() => vi.restoreAllMocks())

describe('ModelsView detail boundary', () => {
  it('keeps context and tier prices in the detail modal', async () => {
    const wrapper = mount(ModelsView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.get('button[aria-label="详情"]').trigger('click')
    await flushPromises()

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('上下文')
    expect(dialog?.textContent).toContain('128K')
    expect(dialog?.textContent).toContain('0-128K')
    expect(dialog?.textContent).toContain('128K+')
  })
})
