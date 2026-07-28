import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import InvoiceView from '@/views/console/InvoiceView.vue'

afterEach(() => vi.restoreAllMocks())

describe('InvoiceView', () => {
  it('keeps invoice submission disabled and directs users to the group owner', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ items: [], total: 0 })
    const post = vi.spyOn(api, 'post')
    await loadMessageDomain('console')
    // setLocale (not a raw locale write) so the zh-CN chunk is backfilled.
    await setLocale('zh-CN')
    const wrapper = mount(InvoiceView, {
      global: { plugins: [i18n] },
    })

    const submit = wrapper.get('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('联系群主可开')

    await wrapper.get('form').trigger('submit')
    expect(post).not.toHaveBeenCalled()
  })
})
