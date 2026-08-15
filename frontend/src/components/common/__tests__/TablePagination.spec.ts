import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import TablePagination from '@/components/common/TablePagination.vue'
import i18n, { setLocale } from '@/i18n'

beforeAll(async () => {
  await setLocale('zh-CN')
})

describe('TablePagination', () => {
  it('keeps the default total summary', () => {
    const wrapper = mount(TablePagination, {
      props: { page: 1, pageSize: 10, total: 24 },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).toContain('共 24 项')
    expect(wrapper.attributes('data-pagination-variant')).toBe('default')
  })

  it('renders modal controls in page-size, pagination, action order', async () => {
    const wrapper = mount(TablePagination, {
      attachTo: document.body,
      props: {
        page: 2,
        pageSize: 5,
        total: 12,
        pageSizes: [5, 10, 30, 50],
        variant: 'modal-footer',
      },
      slots: { actions: '<button data-close>Close</button>' },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).not.toContain('共 12 项')
    const pageSize = wrapper.get('[data-pagination-page-size]').element
    const controls = wrapper.find('[data-pagination-controls]').element
    const actions = wrapper.get('[data-pagination-actions]').element
    expect(
      pageSize.compareDocumentPosition(controls) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      controls.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    const combobox = wrapper.get('[role="combobox"]')
    await combobox.trigger('click')
    await flushPromises()
    const option = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((item) => item.textContent?.trim() === '显示 10')
    expect(option).toBeTruthy()
    option?.click()
    await flushPromises()

    expect(wrapper.emitted('update:page')).toEqual([[1]])
    expect(wrapper.emitted('update:pageSize')).toEqual([[10]])
    wrapper.unmount()
  })
})
