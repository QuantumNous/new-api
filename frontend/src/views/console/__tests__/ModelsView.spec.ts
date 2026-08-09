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
})
