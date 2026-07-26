import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
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

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { adminOrders, mockUser } from '@/api/mock/data'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { AdminOrder } from '@/types/console'
import OrdersView from '@/views/console/OrdersView.vue'

/**
 * zrender needs a real 2D context, which jsdom does not provide. Stubbing the
 * binding keeps OrderRevenueChart itself mounted — including the sr-only data
 * table this view relies on for accessibility — and skips only canvas init.
 */
vi.mock('@/charts/useEChart', () => ({
  useEChart: () => ({ refresh: () => {} }),
}))

const mountedWrappers: VueWrapper[] = []
let pinia: ReturnType<typeof createPinia>

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  writeDemoUser(mockUser)
  pinia = createPinia()
  setActivePinia(pinia)
  useToast().toasts.splice(0)
})

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  resetMockState()
  useToast().toasts.splice(0)
})

afterAll(() => setLocale('zh-CN'))

async function waitForRequests(delay = 0): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, delay))
  await flushPromises()
}

async function mountOrders(): Promise<VueWrapper> {
  const wrapper = mount(OrdersView, {
    attachTo: document.body,
    global: { plugins: [pinia, i18n] },
  })
  mountedWrappers.push(wrapper)
  await waitForRequests()
  return wrapper
}

/** Switches to the order list tab, which is not the default. */
async function openListTab(wrapper: VueWrapper): Promise<void> {
  const tab = wrapper
    .findAll('[role="tab"]')
    .find((button) => button.text() === 'Orders')
  if (!tab) throw new Error('expected the Orders tab')
  await tab.trigger('click')
  await waitForRequests()
}

function dataRows(wrapper: VueWrapper): DOMWrapper<Element>[] {
  return wrapper.findAll('.data-table-body-viewport tbody tr')
}

/** ConsoleModal teleports to body, so the dialog is outside the wrapper tree. */
function openDialog(): HTMLElement {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (!dialog) throw new Error('expected an open dialog')
  return dialog
}

async function clickDialogButton(label: string): Promise<void> {
  const button = [...openDialog().querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  )
  if (!button) throw new Error(`expected a dialog button labelled ${label}`)
  button.click()
  await flushPromises()
}

function completedSeed(): AdminOrder {
  const hit = adminOrders.find((order) => order.status === 'completed')
  if (!hit) throw new Error('expected a completed order seed')
  return hit
}

describe('OrdersView', () => {
  it('opens on the overview tab with the four settled-money metrics', async () => {
    const wrapper = await mountOrders()

    const text = wrapper.text()
    expect(text).toContain("Today's revenue")
    expect(text).toContain('Range revenue')
    expect(text).toContain("Today's sales")
    expect(text).toContain('Average value')
    expect(text).toContain('Daily revenue')
    expect(text).toContain('Payment methods')
    expect(text).toContain('Top spenders')
  })

  it('defaults the statistics window to 30 days', async () => {
    const wrapper = await mountOrders()

    const selected = wrapper
      .findAll('[role="tab"][aria-selected="true"]')
      .map((tab) => tab.text())
    expect(selected).toContain('30 days')
  })

  it('reloads the statistics when the range changes', async () => {
    const wrapper = await mountOrders()
    const spy = vi.spyOn(api, 'get')

    const sevenDays = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === '7 days')
    if (!sevenDays) throw new Error('expected the 7-day segment')
    await sevenDays.trigger('click')
    await waitForRequests()

    expect(spy).toHaveBeenCalledWith(
      '/api/order/stats',
      { range: 7 },
      expect.anything()
    )
    expect(
      wrapper
        .findAll('[role="tab"][aria-selected="true"]')
        .map((tab) => tab.text())
    ).toContain('7 days')
  })

  it('renders the list columns and the first page on the list tab', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    expect(
      wrapper
        .findAll('.data-table-header-clip thead td')
        .map((cell) => cell.text())
        .filter(Boolean)
    ).toEqual([
      'Order ID',
      'Order no.',
      'User',
      'Paid',
      'Payment method',
      'Status',
      'Created',
      'Actions',
    ])
    expect(dataRows(wrapper)).toHaveLength(20)
  })

  it('debounces the keyword search and narrows the page', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)
    const target = adminOrders[2]!

    await wrapper
      .get('input[aria-label="Search order no., email, username or ID"]')
      .setValue(target.order_no)
    await waitForRequests(350)

    const rows = dataRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain(target.order_no)
  })

  it('offers a refund only on completed rows', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    const rows = dataRows(wrapper)
    const refundable = rows.filter((row) =>
      row.find('button[aria-label="Refund"]').exists()
    )
    expect(refundable.length).toBeGreaterThan(0)
    // Every row exposing a refund must be showing the completed chip.
    refundable.forEach((row) => expect(row.text()).toContain('Completed'))

    const nonRefundable = rows.filter(
      (row) => !row.find('button[aria-label="Refund"]').exists()
    )
    expect(nonRefundable.length).toBeGreaterThan(0)
    nonRefundable.forEach((row) =>
      expect(row.text()).not.toContain('Completed')
    )
  })

  it('confirms before refunding and moves the row to refunded', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    const row = dataRows(wrapper).find((candidate) =>
      candidate.find('button[aria-label="Refund"]').exists()
    )
    if (!row) throw new Error('expected a refundable row')
    const orderNo = row.get('td:nth-child(2)').text()

    await row.get('button[aria-label="Refund"]').trigger('click')
    await flushPromises()

    // The confirmation carries the order number and the amount.
    expect(openDialog().textContent).toContain('Refund order')
    expect(openDialog().textContent).toContain(orderNo)

    await clickDialogButton('Confirm refund')
    await waitForRequests()

    const updated = dataRows(wrapper).find((candidate) =>
      candidate.text().includes(orderNo)
    )
    expect(updated?.text()).toContain('Refunded')
    expect(updated?.find('button[aria-label="Refund"]').exists()).toBe(false)
    expect(useToast().toasts.at(-1)?.message).toBe('Order refunded')
  })

  it('keeps the row unchanged when the confirmation is dismissed', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    const row = dataRows(wrapper).find((candidate) =>
      candidate.find('button[aria-label="Refund"]').exists()
    )
    if (!row) throw new Error('expected a refundable row')
    const orderNo = row.get('td:nth-child(2)').text()

    await row.get('button[aria-label="Refund"]').trigger('click')
    await flushPromises()
    await clickDialogButton('Cancel')
    await waitForRequests()

    const unchanged = dataRows(wrapper).find((candidate) =>
      candidate.text().includes(orderNo)
    )
    expect(unchanged?.text()).toContain('Completed')
  })

  it('opens the detail sheet from the view action', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    const row = dataRows(wrapper)[0]!
    const orderNo = row.get('td:nth-child(2)').text()
    await row.get('button[aria-label="View order"]').trigger('click')
    await flushPromises()

    const dialog = openDialog()
    expect(dialog.textContent).toContain('Order detail')
    expect(dialog.textContent).toContain(orderNo)
    expect(dialog.textContent).toContain('Quota credited')
  })

  it('surfaces a load failure with a retry that recovers', async () => {
    const spy = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce(new ApiError('ledger offline'))

    const wrapper = await mountOrders()
    await openListTab(wrapper)

    expect(wrapper.text()).toContain('ledger offline')
    spy.mockRestore()

    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Retry')
    if (!retry) throw new Error('expected the retry button')
    await retry.trigger('click')
    await waitForRequests()

    expect(wrapper.text()).not.toContain('ledger offline')
    expect(dataRows(wrapper).length).toBeGreaterThan(0)
  })

  it('shows an empty state when a filter matches nothing', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    await wrapper
      .get('input[aria-label="Search order no., email, username or ID"]')
      .setValue('no-such-order-anywhere')
    await waitForRequests(350)

    expect(dataRows(wrapper)).toHaveLength(0)
    expect(wrapper.text()).toContain('No matching orders')
  })

  it('reports the filtered revenue alongside the order count', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    expect(wrapper.text()).toContain(`${adminOrders.length} order(s)`)
    expect(wrapper.text()).toContain('collected')
  })

  it('aborts an in-flight list request when the filter changes again', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)
    const input = wrapper.get(
      'input[aria-label="Search order no., email, username or ID"]'
    )
    const target = completedSeed()

    await input.setValue('first')
    await input.setValue(target.order_no)
    await waitForRequests(350)

    const rows = dataRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain(target.order_no)
  })
})

/**
 * The download is intercepted at the Blob boundary, because that payload is the
 * part of an export that can actually regress. jsdom's Blob carries no readable
 * `text()`, so the constructor is stubbed with a recorder instead of reading the
 * instance back; `createObjectURL` and a navigating anchor click do not exist
 * here either, so both are stubbed to no-ops.
 */
interface DownloadCapture {
  content: string
  mime: string
}

function captureDownload(): { get: () => DownloadCapture | null } {
  const capture: { get: () => DownloadCapture | null } = { get: () => null }
  let recorded: DownloadCapture | null = null

  class RecordingBlob {
    constructor(parts: unknown[], options?: { type?: string }) {
      recorded = {
        content: parts.map((part) => String(part)).join(''),
        mime: options?.type ?? '',
      }
    }
  }

  vi.stubGlobal('Blob', RecordingBlob)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:orders')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  capture.get = () => recorded
  return capture
}

/**
 * Drives a FilterSelect the way a user does — open the listbox, click the row —
 * rather than writing to the model. That keeps the test honest about the
 * control's own keyboard/ARIA contract. `root` is the document for the copy
 * inside the teleported export dialog, and the wrapper element otherwise.
 */
async function selectFilterOption(
  root: ParentNode,
  label: string,
  option: string
): Promise<void> {
  const trigger = root.querySelector<HTMLElement>(
    `button[role="combobox"][aria-label="${label}"]`
  )
  if (!trigger) throw new Error(`expected a combobox labelled ${label}`)
  trigger.click()
  await flushPromises()

  const hit = [...root.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (candidate) => candidate.textContent?.trim().startsWith(option)
  )
  if (!hit) throw new Error(`expected an option labelled ${option}`)
  hit.click()
  await flushPromises()
}

/** The export dialog is teleported, so its own FilterSelect lives in the body. */
function selectDialogOption(label: string, option: string): Promise<void> {
  return selectFilterOption(openDialog(), label, option)
}

/**
 * The sweep issues one request per 100 rows, so a single flush is not enough to
 * drain it. Polls until the download lands rather than guessing a delay.
 */
async function waitForDownload(capture: {
  get: () => DownloadCapture | null
}): Promise<DownloadCapture> {
  for (let attempt = 0; attempt < 50 && !capture.get(); attempt++) {
    await waitForRequests()
  }
  const recorded = capture.get()
  if (!recorded) throw new Error('expected a download to have been triggered')
  return recorded
}

/** Opens the export dialog. Returns nothing; the dialog is read from body. */
async function openExportDialog(wrapper: VueWrapper): Promise<void> {
  const trigger = wrapper
    .findAll('button')
    .find((button) => button.text().includes('Export'))
  if (!trigger) throw new Error('expected the export trigger')
  await trigger.trigger('click')
  await flushPromises()
}

async function runExport(
  wrapper: VueWrapper,
  capture: { get: () => DownloadCapture | null }
): Promise<DownloadCapture> {
  await openExportDialog(wrapper)
  await clickDialogButton('Confirm')
  return waitForDownload(capture)
}

describe('OrdersView export', () => {
  it('offers export only on the list tab', async () => {
    const wrapper = await mountOrders()

    const exportVisible = () =>
      wrapper
        .findAll('button')
        .some((button) => button.text().includes('Export'))

    expect(exportVisible()).toBe(false)
    await openListTab(wrapper)
    expect(exportVisible()).toBe(true)
  })

  it('sweeps every page, not just the one on screen', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)
    // The table shows one page of a ledger many pages deep, so a page-scoped
    // export would silently truncate.
    expect(dataRows(wrapper)).toHaveLength(20)

    const capture = captureDownload()
    const { content, mime } = await runExport(wrapper, capture)

    const lines = content.trim().split('\n')
    // Header + one row per seeded order: proof the sweep paged past the table.
    expect(lines).toHaveLength(adminOrders.length + 1)
    expect(lines[0]).toContain('order_no')
    expect(mime).toContain('text/csv')
    expect(useToast().toasts.at(-1)?.message).toContain(
      `${adminOrders.length} order(s)`
    )
  })

  it('exports the active filter rather than the whole ledger', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    const refundedCount = adminOrders.filter(
      (order) => order.status === 'refunded'
    ).length
    expect(refundedCount).toBeGreaterThan(0)
    expect(refundedCount).toBeLessThan(adminOrders.length)

    await selectFilterOption(wrapper.element, 'Order status', 'Refunded')
    await waitForRequests()

    const capture = captureDownload()
    const { content } = await runExport(wrapper, capture)

    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(refundedCount + 1)
    expect(lines.slice(1).every((line) => line.includes('refunded'))).toBe(true)
  })

  it('serialises JSON when that format is chosen', async () => {
    const wrapper = await mountOrders()
    await openListTab(wrapper)

    const capture = captureDownload()
    const trigger = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Export'))
    if (!trigger) throw new Error('expected the export trigger')
    await trigger.trigger('click')
    await flushPromises()

    await selectDialogOption('File type', 'JSON')
    await clickDialogButton('Confirm')

    const { content, mime } = await waitForDownload(capture)
    const parsed = JSON.parse(content)
    expect(parsed).toHaveLength(adminOrders.length)
    expect(parsed[0]).toMatchObject({ order_no: expect.any(String) })
    expect(mime).toContain('application/json')
  })
})
