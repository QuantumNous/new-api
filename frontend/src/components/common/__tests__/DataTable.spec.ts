import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DataTable from '@/components/common/DataTable.vue'
import i18n from '@/i18n'

describe('DataTable keyboard rows', () => {
  it('accepts a page-specific minimum table width', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 1, name: 'Alpha' }],
        rowKey: 'id',
        minTableWidth: '1000px',
      },
      global: { plugins: [i18n] },
    })

    expect(
      wrapper.get('.data-table-header-clip table').attributes('style')
    ).toContain('min-width: 1000px')
    expect(
      wrapper.get('.data-table-body-viewport table').attributes('style')
    ).toContain('min-width: 1000px')
  })

  it('applies optional per-row visual classes', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 1, name: 'Disabled' }],
        rowKey: 'id',
        rowClass: () => 'opacity-75',
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.get('tbody tr').classes()).toContain('opacity-75')
  })

  it('renders custom visual headers without replacing semantic labels', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 1, name: 'Alpha' }],
        rowKey: 'id',
      },
      slots: {
        'header-name':
          '<button class="header-action" type="button">Refresh names</button>',
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.get('.data-table-header-clip .header-action').text()).toBe(
      'Refresh names'
    )
    expect(wrapper.get('.data-table-semantic-head th').text()).toBe('Name')
  })

  it('renders semantic group rows outside normal cells and selection', async () => {
    const rows = [
      { key: 'group:openai', name: 'OpenAI', group: true },
      { key: 'channel:1', name: 'Alpha', group: false },
    ]
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows,
        rowKey: 'key',
        selectable: true,
        rowClickable: true,
        selected: [],
        isGroupRow: (row: Record<string, unknown>) => row.group === true,
      },
      slots: {
        'group-row': '<span class="supplier-group">OpenAI channels</span>',
        'cell-name': '<span class="normal-cell">Channel cell</span>',
      },
      global: { plugins: [i18n] },
    })

    const group = wrapper.get('[data-table-group-row]')
    expect(group.get('th').attributes('scope')).toBe('rowgroup')
    expect(group.get('th').attributes('colspan')).toBe('2')
    expect(group.find('.normal-cell').exists()).toBe(false)
    expect(wrapper.findAll('.normal-cell')).toHaveLength(1)

    await group.trigger('click')
    expect(wrapper.emitted('row-click')).toBeUndefined()

    await wrapper.get('thead input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('update:selected')?.at(-1)?.[0]).toEqual([
      'channel:1',
    ])
  })

  it('uses explicit selection keys for collapsed or hidden data rows', async () => {
    const rows = [
      { key: 'group:openai', name: 'OpenAI', group: true },
      { key: 'channel:1', name: 'Alpha', group: false },
    ]
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows,
        rowKey: 'key',
        selectable: true,
        selected: [],
        selectionKeys: ['channel:1', 'channel:2'],
        isGroupRow: (row: Record<string, unknown>) => row.group === true,
      },
      global: { plugins: [i18n] },
    })

    await wrapper.get('thead input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('update:selected')?.at(-1)?.[0]).toEqual([
      'channel:1',
      'channel:2',
    ])

    await wrapper.setProps({ selectionDisabled: true })
    await wrapper.get('thead input[type="checkbox"]').setValue(false)
    expect(wrapper.emitted('update:selected')).toHaveLength(1)
  })

  it('hands programmatic header scrolling to the body viewport', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name', width: '500px' },
          { key: 'status', label: 'Status', width: '500px' },
        ],
        rows: [{ id: 1, name: 'Alpha', status: 'Enabled' }],
        rowKey: 'id',
        minTableWidth: '1000px',
      },
      global: { plugins: [i18n] },
    })
    const header = wrapper.get('.data-table-header-clip')
    const body = wrapper.get('.data-table-body-viewport')
    Object.defineProperty(body.element, 'scrollWidth', {
      configurable: true,
      value: 1000,
    })
    Object.defineProperty(body.element, 'clientWidth', {
      configurable: true,
      value: 600,
    })
    ;(header.element as HTMLElement).scrollLeft = 240

    await header.trigger('scroll')

    expect((header.element as HTMLElement).scrollLeft).toBe(0)
    expect((body.element as HTMLElement).scrollLeft).toBe(240)
  })

  it('activates clickable rows with Enter and Space but ignores child controls', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 1, name: 'Alpha' }],
        rowKey: 'id',
        rowClickable: true,
      },
      slots: {
        'cell-name': '<button class="child-control">Child</button>',
      },
      global: { plugins: [i18n] },
    })
    const row = wrapper.get('tbody tr')

    await row.trigger('keydown', { key: 'Enter' })
    await row.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('row-click')).toHaveLength(2)

    await wrapper.get('.child-control').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('row-click')).toHaveLength(2)
  })

  it('keeps single clicks inert for double-click-only rows', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 1, name: 'Alpha' }],
        rowKey: 'id',
        rowDblclickable: true,
      },
      slots: {
        'cell-name': '<button class="child-control">Child</button>',
      },
      global: { plugins: [i18n] },
    })
    const row = wrapper.get('tbody tr')

    await row.trigger('click')
    expect(wrapper.emitted('row-click')).toBeUndefined()
    expect(wrapper.emitted('row-dblclick')).toBeUndefined()

    await row.trigger('dblclick')
    await row.trigger('keydown', { key: 'Enter' })
    await row.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('row-dblclick')).toHaveLength(3)

    await wrapper.get('.child-control').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('row-dblclick')).toHaveLength(3)
  })

  it('keeps mouse click hints separate from keyboard activation', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 1, name: 'Alpha' }],
        rowKey: 'id',
        rowClickable: true,
        rowDblclickable: true,
      },
      global: { plugins: [i18n] },
    })
    const row = wrapper.get('tbody tr')

    await row.trigger('click')
    expect(wrapper.emitted('row-click')).toHaveLength(1)

    await row.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('row-dblclick')).toHaveLength(1)
  })
})
