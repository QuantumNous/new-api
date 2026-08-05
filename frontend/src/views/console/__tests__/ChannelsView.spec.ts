import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { adminChannels, mockUser } from '@/api/mock/data'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  ADMIN_CHANNEL_DEFAULT_VISIBLE_FIELDS,
  ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY,
} from '@/constants/adminChannels'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { AdminChannel } from '@/types/console'
import ChannelsView from '@/views/console/ChannelsView.vue'

const mountedWrappers: VueWrapper[] = []
let pinia: Pinia

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  resetMockState()
  setMockDelay(0)
  writeDemoUser(mockUser)
  useToast().toasts.splice(0)
  localStorage.removeItem(ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY)
})

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  resetMockState()
  useToast().toasts.splice(0)
  localStorage.removeItem(ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY)
})

afterAll(() => setLocale('zh-CN'))

async function waitForRequests(delay = 0): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, delay))
  await flushPromises()
}

async function mountChannels(): Promise<VueWrapper> {
  const wrapper = mount(ChannelsView, {
    attachTo: document.body,
    global: { plugins: [pinia, i18n] },
  })
  mountedWrappers.push(wrapper)
  await waitForRequests()
  return wrapper
}

interface PendingChannelRequest {
  id: number
  signal?: AbortSignal
  resolve(channel?: AdminChannel): void
  reject(error?: Error): void
}

function mockPendingChannelRequests(action: 'balance' | 'test') {
  const originalGet = api.get.bind(api)
  const pending: PendingChannelRequest[] = []
  const pathPart =
    action === 'balance' ? '/api/channel/update_balance/' : '/api/channel/test/'

  vi.spyOn(api, 'get').mockImplementation(
    <T>(
      url: string,
      params?: Record<string, unknown>,
      options?: { signal?: AbortSignal }
    ): Promise<T> => {
      if (!url.includes(pathPart)) return originalGet<T>(url, params, options)

      const id = Number(url.split('/').at(-1))
      return new Promise<T>((resolve, reject) => {
        const request: PendingChannelRequest = {
          id,
          signal: options?.signal,
          resolve(channel) {
            const source = adminChannels.find((item) => item.id === id)
            if (!source) throw new Error(`missing channel ${id}`)
            resolve(
              (channel ?? {
                ...source,
                balance: source.balance + 10,
                upstream_ratio: source.upstream_ratio + 0.07,
                response_time: source.response_time || 480,
                test_time: Math.floor(Date.now() / 1000),
              }) as T
            )
          },
          reject(
            error = new ApiError('batch request failed', { business: true })
          ) {
            reject(error)
          },
        }
        options?.signal?.addEventListener(
          'abort',
          () => request.reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        )
        pending.push(request)
      })
    }
  )

  return pending
}

async function resolveBatch(
  pending: PendingChannelRequest[],
  start: number,
  end: number
) {
  pending.slice(start, end).forEach((request) => request.resolve())
  await flushPromises()
}

describe('ChannelsView', () => {
  it('renders default fields and keeps page and supplier actions visible', async () => {
    const wrapper = await mountChannels()
    const headers = wrapper
      .findAll('.data-table-header-clip thead td')
      .slice(1)
      .map((header) => header.text())

    expect(headers).toEqual([
      'Name',
      'Type',
      'Status',
      'Priority',
      'Weight',
      'Capacity',
      'Usage / channel ratio',
      'Upstream balance / ratio',
      'Response',
      'Actions',
    ])
    const mobileRow = wrapper.get('[data-channel-mobile-row]')
    expect(mobileRow.text()).toContain(adminChannels[0]!.name)
    expect(mobileRow.text()).toContain('Capacity')
    expect(mobileRow.text()).toContain('Channel ratio')
    expect(mobileRow.text()).toContain('Upstream ratio')
    expect(mobileRow.findAll('footer button')).toHaveLength(3)
    expect(mobileRow.get('input[type="checkbox"]').classes()).toContain(
      'checkbox-round'
    )
    expect(
      wrapper
        .get('input[aria-label="Select current page channels"]')
        .attributes('type')
    ).toBe('checkbox')
    expect(
      wrapper.get('.data-table-header-clip input[type="checkbox"]').classes()
    ).toContain('checkbox-round')
    expect(
      mobileRow
        .find('button[aria-label="Sync upstream balance and ratio"]')
        .exists()
    ).toBe(false)
    expect(mobileRow.find('button[aria-label="Test response"]').exists()).toBe(
      false
    )

    const firstDesktopRow = wrapper.get(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    expect(
      firstDesktopRow
        .find('button[aria-label="Sync upstream balance and ratio"]')
        .exists()
    ).toBe(false)
    expect(
      firstDesktopRow.find('button[aria-label="Test response"]').exists()
    ).toBe(false)
    expect(
      firstDesktopRow.findAll('td').at(-1)?.findAll('button')
    ).toHaveLength(3)
    expect(
      wrapper
        .find('.data-table-header-clip button[aria-label^="Sync upstream"]')
        .exists()
    ).toBe(true)
    expect(
      wrapper
        .find('.data-table-header-clip button[aria-label^="Test responses"]')
        .exists()
    ).toBe(true)
    expect(
      wrapper
        .find(
          '.data-table-body-viewport button[aria-label="Sync OpenAI upstream balances and ratios"]'
        )
        .exists()
    ).toBe(true)
    expect(
      wrapper
        .find(
          '.data-table-body-viewport button[aria-label="Clear OpenAI channels"]'
        )
        .exists()
    ).toBe(true)
  })

  it('groups the current page by supplier and shares collapse state', async () => {
    const wrapper = await mountChannels()
    const expectedSuppliers = new Set(
      adminChannels.slice(0, 20).map((channel) => channel.supplier)
    )
    expect(
      wrapper.findAll('.data-table-body-viewport [data-table-group-row]')
    ).toHaveLength(expectedSuppliers.size)

    const openAiCount = adminChannels
      .slice(0, 20)
      .filter((channel) => channel.supplier === 'OpenAI').length
    const desktopToggle = wrapper
      .findAll('button[aria-label="Collapse OpenAI channel group"]')
      .at(0)
    if (!desktopToggle) throw new Error('expected OpenAI supplier group')
    expect(desktopToggle.text()).toContain(`${openAiCount} channels`)

    const before = wrapper.findAll(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    ).length
    await desktopToggle.trigger('click')
    expect(
      wrapper.findAll(
        '.data-table-body-viewport tbody tr:not([data-table-group-row])'
      )
    ).toHaveLength(before - openAiCount)
    expect(
      wrapper
        .findAll('button[aria-label="Expand OpenAI channel group"]')
        .some((button) => button.attributes('aria-expanded') === 'false')
    ).toBe(true)
  })

  it('sanitizes and applies persisted field visibility on desktop and mobile', async () => {
    localStorage.setItem(
      ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY,
      JSON.stringify(['id', 'usage', 'stale-field'])
    )
    const wrapper = await mountChannels()

    expect(
      wrapper
        .findAll('.data-table-header-clip thead td')
        .slice(1)
        .map((header) => header.text())
    ).toEqual(['ID', 'Name', 'Usage / channel ratio', 'Actions'])
    const mobileRow = wrapper.get('[data-channel-mobile-row]')
    expect(mobileRow.text()).toContain('Channel ratio')
    expect(mobileRow.text()).not.toContain('Capacity')
    expect(mobileRow.text()).not.toContain('Upstream ratio')
    expect(
      JSON.parse(
        localStorage.getItem(ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY) ?? '[]'
      )
    ).toEqual(['id', 'usage'])

    await wrapper.get('button[aria-label="Visible fields"]').trigger('click')
    const capacityToggle = wrapper
      .findAll('[role="dialog"] button')
      .find((button) => button.text().includes('Capacity'))
    if (!capacityToggle) throw new Error('expected capacity visibility option')
    await capacityToggle.trigger('click')
    expect(
      wrapper
        .findAll('.data-table-header-clip thead td')
        .map((header) => header.text())
    ).toContain('Capacity')
    expect(wrapper.get('[data-channel-mobile-row]').text()).toContain(
      'Capacity'
    )
  })

  it('syncs upstream balance and ratio in one row request', async () => {
    localStorage.setItem(
      ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY,
      JSON.stringify([
        ...ADMIN_CHANNEL_DEFAULT_VISIBLE_FIELDS,
        'rowUpstreamAction',
      ])
    )
    const wrapper = await mountChannels()
    const target = adminChannels[0]!
    const balanceBefore = target.balance
    const ratioBefore = target.upstream_ratio
    const row = wrapper.get(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    const cells = row.findAll('td')

    await cells[8]
      ?.get('button[aria-label="Sync upstream balance and ratio"]')
      .trigger('click')
    await waitForRequests()

    expect(target.balance).not.toBe(balanceBefore)
    expect(target.upstream_ratio).not.toBe(ratioBefore)
    expect(cells[8]?.text()).toContain(target.upstream_ratio.toFixed(2))
    expect(useToast().toasts.at(-1)?.message).toBe(
      'Upstream balance and ratio synced'
    )
  })

  it('enables and disables all selected current-page channels', async () => {
    const wrapper = await mountChannels()
    await wrapper
      .findAll('button[aria-label="Collapse OpenAI channel group"]')
      .at(0)
      ?.trigger('click')
    const selectAll = wrapper.get(
      '.data-table-header-clip thead input[type="checkbox"]'
    )
    await selectAll.setValue(true)
    expect(wrapper.get('[data-channel-bulk-actions]').text()).toContain(
      '20 selected'
    )

    await wrapper
      .get('button[aria-label="Disable selected channels"]')
      .trigger('click')
    await waitForRequests()

    expect(
      adminChannels.slice(0, 20).every((channel) => channel.status === 2)
    ).toBe(true)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-channel-bulk-actions]').exists()).toBe(false)
    })
    expect(useToast().toasts.at(-1)?.message).toMatch(
      /Disabled \d+ selected channels/
    )

    await selectAll.setValue(true)
    await wrapper
      .get('button[aria-label="Enable selected channels"]')
      .trigger('click')
    await waitForRequests()

    expect(
      adminChannels.slice(0, 20).every((channel) => channel.status === 1)
    ).toBe(true)
    expect(useToast().toasts.at(-1)?.message).toBe(
      'Enabled 20 selected channels'
    )
  })

  it('resets only selected auto-disabled channels', async () => {
    const wrapper = await mountChannels()
    const target = adminChannels
      .slice(0, 20)
      .find((channel) => channel.status === 3)
    if (!target) throw new Error('expected an auto-disabled channel')
    const row = wrapper
      .findAll('.data-table-body-viewport tbody tr:not([data-table-group-row])')
      .find((candidate) => candidate.text().includes(target.name))
    if (!row) throw new Error('expected the auto-disabled channel row')
    await row.get('input[type="checkbox"]').setValue(true)

    await wrapper
      .get('button[aria-label="Reset auto-disabled channels"]')
      .trigger('click')
    await waitForRequests()

    expect(target.status).toBe(1)
    expect(useToast().toasts.at(-1)?.message).toBe(
      'Reset 1 auto-disabled channels'
    )
  })

  it('confirms and deletes selected channels', async () => {
    const wrapper = await mountChannels()
    const targets = adminChannels.slice(0, 2)
    const targetIds = targets.map((channel) => channel.id)
    const rows = wrapper.findAll(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    for (const target of targets) {
      const row = rows.find((candidate) =>
        candidate.text().includes(target.name)
      )
      if (!row) throw new Error(`expected channel row for ${target.name}`)
      await row.get('input[type="checkbox"]').setValue(true)
    }

    await wrapper
      .get('button[aria-label="Delete selected channels"]')
      .trigger('click')
    const body = new DOMWrapper(document.body)
    const dialog = body.get('[role="dialog"]')
    expect(dialog.text()).toContain('selected 2 channels')
    const confirm = dialog
      .findAll('button')
      .find((button) => button.text() === 'Delete')
    if (!confirm) throw new Error('expected bulk delete confirmation')
    await confirm.trigger('click')
    await waitForRequests()

    expect(
      adminChannels.some((channel) => targetIds.includes(channel.id))
    ).toBe(false)
    expect(useToast().toasts.at(-1)?.message).toBe(
      'Deleted 2 selected channels'
    )
  })

  it('creates channels with derived suppliers and runtime defaults', async () => {
    const wrapper = await mountChannels()
    const originalLength = adminChannels.length
    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('New channel'))
    if (!createButton) throw new Error('expected new-channel button')

    await createButton.trigger('click')
    const body = new DOMWrapper(document.body)
    expect(body.get('[role="dialog"]').text()).toContain(
      'Matched automatically from channel type'
    )
    await body.get('input[name="admin-channel-name"]').setValue('New route')
    await body.get('input[name="admin-channel-ratio"]').setValue('1.26')
    const disabledStatus = body
      .findAll('button')
      .find((button) => button.text() === 'Manually disabled')
    if (!disabledStatus) throw new Error('expected create-status selector')
    await disabledStatus.trigger('click')
    const save = body
      .findAll('button')
      .find((button) => button.text().includes('Save channel'))
    if (!save) throw new Error('expected save-channel button')
    await save.trigger('click')
    await waitForRequests()

    expect(adminChannels).toHaveLength(originalLength + 1)
    expect(
      adminChannels.find((channel) => channel.name === 'New route')
    ).toMatchObject({
      supplier: 'OpenAI',
      status: 2,
      capacity_used: 0,
      used_quota: 0,
      channel_ratio: 1.26,
      balance: 0,
      upstream_ratio: 1,
      response_time: 0,
    })
    expect(useToast().toasts.at(-1)?.message).toBe('Channel created')
  })

  it('edits operational fields and regroups a changed channel type', async () => {
    const wrapper = await mountChannels()
    const target = adminChannels[0]!
    const row = wrapper.get(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    await row.get('button[aria-label="Edit channel"]').trigger('click')

    const body = new DOMWrapper(document.body)
    await body.get('input[name="admin-channel-name"]').setValue('Moved Bedrock')
    await body.get('input[name="admin-channel-ratio"]').setValue('0')
    await body.get('button[aria-label="Type"]').trigger('click')
    const bedrock = body
      .findAll('[role="option"]')
      .find((option) => option.text() === 'AWS Bedrock')
    if (!bedrock) throw new Error('expected Bedrock type option')
    await bedrock.trigger('click')
    const save = body
      .findAll('button')
      .find((button) => button.text().includes('Save channel'))
    if (!save) throw new Error('expected save-channel button')
    await save.trigger('click')
    await waitForRequests()

    expect(target).toMatchObject({
      name: 'Moved Bedrock',
      type: 33,
      supplier: 'Anthropic',
      channel_ratio: 0,
    })
    expect(wrapper.text()).toContain('Moved Bedrock')
    expect(
      wrapper.findAll('button[aria-label="Collapse Anthropic channel group"]')
        .length
    ).toBeGreaterThan(0)
  })

  it('confirms deletion and keeps the dialog open after a failed request', async () => {
    const wrapper = await mountChannels()
    const target = adminChannels[0]!
    const row = wrapper.get(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    await row.get('button[aria-label="Delete channel"]').trigger('click')

    const body = new DOMWrapper(document.body)
    const dialog = body.get('[role="dialog"]')
    expect(dialog.text()).toContain(target.name)
    vi.spyOn(api, 'delete').mockRejectedValueOnce(
      new ApiError('delete rejected', { business: true })
    )
    const confirm = dialog
      .findAll('button')
      .find((button) => button.text() === 'Delete')
    if (!confirm) throw new Error('expected delete confirmation')
    await confirm.trigger('click')
    await waitForRequests()

    expect(adminChannels).toContain(target)
    expect(body.find('[role="dialog"]').exists()).toBe(true)
    expect(useToast().toasts.at(-1)?.message).toBe('delete rejected')

    vi.restoreAllMocks()
    const retryConfirm = body
      .get('[role="dialog"]')
      .findAll('button')
      .find((button) => button.text() === 'Delete')
    if (!retryConfirm) throw new Error('expected delete retry')
    await retryConfirm.trigger('click')
    await waitForRequests()
    expect(adminChannels).not.toContain(target)
    await vi.waitFor(() => {
      expect(
        body.findAll('[role="dialog"]').map((item) => item.text())
      ).toEqual([])
    })
    expect(useToast().toasts.at(-1)?.message).toBe('Channel deleted')
  })

  it('returns to the previous page after deleting its last channel', async () => {
    adminChannels.splice(21)
    const target = adminChannels[20]!
    const wrapper = await mountChannels()
    const pageTwo = wrapper.findAll('button[aria-label="Go to page 2"]').at(0)
    if (!pageTwo) throw new Error('expected page two')
    await pageTwo.trigger('click')
    await waitForRequests()

    const row = wrapper.get(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    expect(row.text()).toContain(target.name)
    await row.get('button[aria-label="Delete channel"]').trigger('click')
    const body = new DOMWrapper(document.body)
    const confirm = body
      .get('[role="dialog"]')
      .findAll('button')
      .find((button) => button.text() === 'Delete')
    if (!confirm) throw new Error('expected delete confirmation')
    await confirm.trigger('click')
    await waitForRequests(50)

    expect(adminChannels).toHaveLength(20)
    expect(wrapper.findAll('button[aria-label="Go to page 2"]')).toHaveLength(0)
    expect(
      wrapper
        .get('.data-table-body-viewport tbody tr:not([data-table-group-row])')
        .text()
    ).toContain(adminChannels[0]!.name)
  })

  it('processes a current-page snapshot in sequential batches of five', async () => {
    const wrapper = await mountChannels()
    const expectedIds = adminChannels.slice(0, 20).map((channel) => channel.id)
    const pending = mockPendingChannelRequests('balance')
    const batchButton = wrapper.get(
      '.data-table-header-clip button[aria-label="Sync upstream balances and ratios for 20 visible channels"]'
    )

    const openAiToggle = wrapper
      .findAll('button[aria-label="Collapse OpenAI channel group"]')
      .at(0)
    await openAiToggle?.trigger('click')

    await batchButton.trigger('click')
    await flushPromises()
    expect(pending.map((request) => request.id)).toEqual(
      expectedIds.slice(0, 5)
    )
    expect(wrapper.text()).toContain('0/20')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('New channel'))
        ?.attributes()
    ).toHaveProperty('disabled')
    expect(
      wrapper
        .get('.data-table-body-viewport tbody tr input[type="number"]')
        .attributes()
    ).toHaveProperty('disabled')

    const pageTwo = wrapper.findAll('button[aria-label="Go to page 2"]').at(0)
    if (!pageTwo) throw new Error('expected page two during batch')
    await pageTwo.trigger('click')
    await waitForRequests()

    await resolveBatch(pending, 0, 5)
    expect(pending).toHaveLength(10)
    expect(wrapper.text()).toContain('5/20')
    await resolveBatch(pending, 5, 10)
    expect(pending).toHaveLength(15)
    await resolveBatch(pending, 10, 15)
    expect(pending).toHaveLength(20)
    await resolveBatch(pending, 15, 20)

    expect(pending.map((request) => request.id)).toEqual(expectedIds)
    expect(useToast().toasts).toHaveLength(1)
    expect(useToast().toasts[0]).toMatchObject({
      type: 'success',
      message: 'Upstream sync completed for 20 channels',
    })
    expect(batchButton.attributes()).not.toHaveProperty('disabled')
  })

  it('continues batch work after failures and reports one summary toast', async () => {
    const wrapper = await mountChannels()
    const pending = mockPendingChannelRequests('test')
    const batchButton = wrapper.get(
      '.data-table-header-clip button[aria-label="Test responses for 20 visible channels"]'
    )

    await batchButton.trigger('click')
    await flushPromises()
    pending[0]?.reject()
    await resolveBatch(pending, 1, 5)
    expect(pending).toHaveLength(10)
    pending[7]?.reject()
    await resolveBatch(pending, 5, 7)
    await resolveBatch(pending, 8, 10)
    await resolveBatch(pending, 10, 15)
    await resolveBatch(pending, 15, 20)

    expect(pending).toHaveLength(20)
    expect(useToast().toasts).toHaveLength(1)
    expect(useToast().toasts[0]).toMatchObject({
      type: 'warning',
      message: 'Response test completed: 18/20 succeeded, 2 failed',
    })
  })

  it('runs supplier actions only for the current-page group in batches of five', async () => {
    const wrapper = await mountChannels()
    const expectedIds = adminChannels
      .slice(0, 20)
      .filter((channel) => channel.supplier === 'OpenAI')
      .map((channel) => channel.id)
    const pending = mockPendingChannelRequests('balance')
    const button = wrapper.get(
      '.data-table-body-viewport button[aria-label="Sync OpenAI upstream balances and ratios"]'
    )

    await button.trigger('click')
    await flushPromises()
    expect(pending.map((request) => request.id)).toEqual(
      expectedIds.slice(0, 5)
    )

    for (let start = 0; start < expectedIds.length; start += 5) {
      await resolveBatch(
        pending,
        start,
        Math.min(start + 5, expectedIds.length)
      )
    }

    expect(pending.map((request) => request.id)).toEqual(expectedIds)
    expect(useToast().toasts).toHaveLength(1)
    expect(useToast().toasts[0]).toMatchObject({
      type: 'success',
      message: `Upstream sync completed for ${expectedIds.length} channels`,
    })
  })

  it('clears the current-page supplier group after confirmation', async () => {
    const wrapper = await mountChannels()
    const targets = adminChannels
      .slice(0, 20)
      .filter((channel) => channel.supplier === 'OpenAI')
    const targetIds = targets.map((channel) => channel.id)

    await wrapper
      .get(
        '.data-table-body-viewport button[aria-label="Clear OpenAI channels"]'
      )
      .trigger('click')

    const body = new DOMWrapper(document.body)
    const dialog = body.get('[role="dialog"]')
    expect(dialog.text()).toContain(`${targets.length} visible channels`)
    const confirm = dialog
      .findAll('button')
      .find((button) => button.text() === 'Delete')
    if (!confirm) throw new Error('expected supplier clear confirmation')
    await confirm.trigger('click')
    await waitForRequests()

    expect(
      adminChannels.some((channel) => targetIds.includes(channel.id))
    ).toBe(false)
    expect(useToast().toasts.at(-1)?.message).toBe(
      `Cleared ${targets.length} channels from OpenAI`
    )
  })

  it('aborts the active batch on unmount without showing a summary', async () => {
    const wrapper = await mountChannels()
    const pending = mockPendingChannelRequests('test')
    const batchButton = wrapper.get(
      '.data-table-header-clip button[aria-label="Test responses for 20 visible channels"]'
    )

    await batchButton.trigger('click')
    await flushPromises()
    expect(pending).toHaveLength(5)
    wrapper.unmount()
    await flushPromises()

    expect(pending.every((request) => request.signal?.aborted)).toBe(true)
    expect(useToast().toasts).toHaveLength(0)
  })

  it('debounces search and renders the empty state for no matches', async () => {
    const wrapper = await mountChannels()
    const search = wrapper.get('input[name="admin-channel-search"]')

    await search.setValue('no-channel-can-match-this')
    await waitForRequests(100)
    expect(wrapper.text()).not.toContain('No matching channels')

    await waitForRequests(230)
    expect(wrapper.text()).toContain('No matching channels')
  })

  it('resets pagination when a filter changes', async () => {
    const wrapper = await mountChannels()
    const pageTwo = wrapper.findAll('button[aria-label="Go to page 2"]').at(0)
    if (!pageTwo) throw new Error('expected a page-two button')

    await pageTwo.trigger('click')
    await waitForRequests()
    expect(pageTwo.attributes('aria-current')).toBe('page')

    await wrapper.get('button[aria-label="Channel status"]').trigger('click')
    const enabled = wrapper
      .findAll('[role="option"]')
      .find((option) => option.text().includes('Enabled only'))
    if (!enabled) throw new Error('expected enabled status option')
    await enabled.trigger('click')
    await waitForRequests()

    expect(
      wrapper
        .findAll('button[aria-label="Go to page 1"]')
        .at(0)
        ?.attributes('aria-current')
    ).toBe('page')
  })

  it('commits inline numbers and restores the current value on Escape', async () => {
    const wrapper = await mountChannels()
    const target = adminChannels[0]!
    const input = wrapper.get(`input[aria-label="Priority for ${target.name}"]`)

    ;(input.element as HTMLInputElement).focus()
    await input.setValue('47')
    await input.trigger('keydown', { key: 'Enter' })
    await waitForRequests()
    expect(target.priority).toBe(47)
    expect((input.element as HTMLInputElement).value).toBe('47')

    ;(input.element as HTMLInputElement).focus()
    await input.setValue('88')
    await input.trigger('keydown', { key: 'Escape' })
    await waitForRequests()
    expect(target.priority).toBe(47)
    expect((input.element as HTMLInputElement).value).toBe('47')
  })

  it('locks the whole row while one channel operation is in flight', async () => {
    localStorage.setItem(
      ADMIN_CHANNEL_VISIBLE_FIELDS_STORAGE_KEY,
      JSON.stringify([
        ...ADMIN_CHANNEL_DEFAULT_VISIBLE_FIELDS,
        'rowUpstreamAction',
        'rowResponseAction',
      ])
    )
    setMockDelay(40)
    const getSpy = vi.spyOn(api, 'get')
    const wrapper = mount(ChannelsView, {
      attachTo: document.body,
      global: { plugins: [pinia, i18n] },
    })
    mountedWrappers.push(wrapper)
    await waitForRequests(45)

    const firstRow = wrapper.get(
      '.data-table-body-viewport tbody tr:not([data-table-group-row])'
    )
    const testButton = firstRow.get('button[aria-label="Test response"]')
    const balanceButton = firstRow.get(
      'button[aria-label="Sync upstream balance and ratio"]'
    )

    await testButton.trigger('click')
    await testButton.trigger('click')
    expect(balanceButton.attributes()).toHaveProperty('disabled')
    await waitForRequests(45)

    const testRequests = getSpy.mock.calls.filter(([url]) =>
      String(url).includes('/api/channel/test/')
    )
    expect(testRequests).toHaveLength(1)
    expect(balanceButton.attributes()).not.toHaveProperty('disabled')
  })

  it('shows initial failures and preserves failed inline edits', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(
      new ApiError('channel service unavailable', { status: 503 })
    )
    const wrapper = mount(ChannelsView, {
      attachTo: document.body,
      global: { plugins: [pinia, i18n] },
    })
    mountedWrappers.push(wrapper)
    await waitForRequests()

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'channel service unavailable'
    )

    vi.restoreAllMocks()
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Retry'))
    if (!retry) throw new Error('expected the initial-error retry button')
    await retry.trigger('click')
    await waitForRequests()

    const target = adminChannels[0]!
    const original = target.priority
    vi.spyOn(api, 'put').mockRejectedValueOnce(
      new ApiError('update rejected', { business: true })
    )
    const input = wrapper.get(`input[aria-label="Priority for ${target.name}"]`)
    ;(input.element as HTMLInputElement).focus()
    await input.setValue(String(original + 1))
    await input.trigger('keydown', { key: 'Enter' })
    await waitForRequests()

    expect(target.priority).toBe(original)
    expect((input.element as HTMLInputElement).value).toBe(String(original))
    expect(useToast().toasts.at(-1)?.message).toBe('update rejected')
  })
})
