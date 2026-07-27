import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import KeyMobileList from '@/components/console/keys/KeyMobileList.vue'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { TokenSummary } from '@/types/console'

const token: TokenSummary = {
  id: 7,
  name: 'Production key',
  key_preview: 'sk-prod...1234',
  type: 'auto',
  status: 1,
  used_quota: 250,
  remain_quota: 750,
  unlimited: false,
  group: 'default',
  model_limits: [],
  ip_limits: [],
  rate_limit: 0,
  load_balance: true,
  channels: [],
  expired_time: -1,
  created_time: 1_722_000_000,
}

async function mountList() {
  await loadMessageDomain('console')
  await setLocale('zh-CN')

  const actions = {
    toggleAllSelected: vi.fn(),
    toggleSelected: vi.fn(),
    toggleStatus: vi.fn(),
    viewKey: vi.fn(),
    manageChannels: vi.fn(),
    editKey: vi.fn(),
    deleteKey: vi.fn(),
  }
  const wrapper = mount(KeyMobileList, {
    props: {
      tokens: [token],
      selectedIds: [],
      allSelected: false,
      isToggling: () => false,
      ...actions,
    },
    global: { plugins: [i18n] },
  })

  return { wrapper, actions }
}

describe('KeyMobileList', () => {
  it('renders the complete mobile token summary without a wide table', async () => {
    const { wrapper } = await mountList()

    expect(wrapper.get('[data-key-mobile-row]').text()).toContain(
      'Production key'
    )
    expect(wrapper.text()).toContain('sk-prod...1234')
    expect(wrapper.text()).toContain('自动令牌')
    expect(wrapper.text()).toContain('永不过期')
  })

  it('keeps selection and every row action reachable', async () => {
    const { wrapper, actions } = await mountList()
    const row = wrapper.get('[data-key-mobile-row]')

    await wrapper.get('label input[type="checkbox"]').trigger('change')
    await row.get('input[type="checkbox"]').trigger('change')
    await row.get('header button[aria-label="启停"]').trigger('click')
    await row.get('button[aria-label="查看完整密钥"]').trigger('click')
    await row.get('button[aria-label="查看路由渠道管理"]').trigger('click')
    await row.get('button[aria-label="编辑令牌"]').trigger('click')
    await row.get('button[aria-label="删除"]').trigger('click')

    expect(actions.toggleAllSelected).toHaveBeenCalledOnce()
    expect(actions.toggleSelected).toHaveBeenCalledWith(token)
    expect(actions.toggleStatus).toHaveBeenCalledWith(token)
    expect(actions.viewKey).toHaveBeenCalledWith(token)
    expect(actions.manageChannels).toHaveBeenCalledWith(token)
    expect(actions.editKey).toHaveBeenCalledWith(token)
    expect(actions.deleteKey).toHaveBeenCalledWith(token)
  })
})
