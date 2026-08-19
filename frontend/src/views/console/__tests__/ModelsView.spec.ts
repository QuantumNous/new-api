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
import ModelsView from '@/views/console/ModelsView.vue'

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({ models: ['gpt-4o'] })
})

afterEach(() => vi.restoreAllMocks())

describe('ModelsView live boundary', () => {
  it('renders backend model names without invented pricing metadata', async () => {
    const wrapper = mount(ModelsView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await flushPromises()

    expect(api.get).toHaveBeenCalledWith('/api/user/models')
    expect(wrapper.text()).toContain('gpt-4o')
    expect(wrapper.text()).toContain('共 1 个模型')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('shows cache read and cache write prices in model details', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ models: ['gpt-4o'] })
      .mockResolvedValueOnce([
        {
          model_name: 'gpt-4o',
          description: 'General model',
          quota_type: 0,
          model_ratio: 0.5,
          completion_ratio: 2,
          cache_ratio: 0.25,
          create_cache_ratio: 1.25,
          owner_by: 'OpenAI',
          supported_endpoint_types: ['chat'],
          enable_groups: ['default'],
        },
      ])
      .mockResolvedValueOnce({ models: [] })

    const wrapper = mount(ModelsView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.get('button[title="详情"]').trigger('click')
    await flushPromises()

    expect(
      document.body.querySelector('[data-detail-cache-read]')?.textContent
    ).toContain('$0.2500')
    expect(
      document.body.querySelector('[data-detail-cache-write]')?.textContent
    ).toContain('$1.2500')
  })
})
