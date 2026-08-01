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

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { logs, mockUser } from '@/api/mock/data'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { useToast } from '@/composables/useToast'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import LogsView from '@/views/console/LogsView.vue'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  // /api/log/self is behind requireAuth; without this the initial load 401s and
  // every assertion runs against an empty table.
  writeDemoUser(mockUser)
  useToast().toasts.splice(0)
})

afterEach(() => {
  vi.restoreAllMocks()
  resetMockState()
  useToast().toasts.splice(0)
  document.body.innerHTML = ''
})

afterAll(() => setLocale('zh-CN'))

async function settleLogRequests(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  await flushPromises()
}

/**
 * jsdom has no Blob download path, so the anchor click is neutralised and the
 * serialized payload is captured from createObjectURL instead.
 */
/** jsdom's Blob implements neither text() nor arrayBuffer(); FileReader works. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(blob)
  })
}

function captureDownload(): { blobs: Blob[]; names: string[] } {
  const blobs: Blob[] = []
  const names: string[] = []

  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    (blob: Blob | MediaSource) => {
      blobs.push(blob as Blob)
      return 'blob:mock'
    }
  )
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreate(tag) as HTMLElement
    if (tag === 'a') {
      vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
        names.push((el as HTMLAnchorElement).download)
      })
    }
    return el
  })

  return { blobs, names }
}

async function openExportDialog(wrapper: VueWrapper): Promise<void> {
  const trigger = wrapper
    .findAll('button')
    .find((button) => button.text() === 'Export')
  if (!trigger) throw new Error('expected the export trigger')
  await trigger.trigger('click')
  await flushPromises()
}

/** ConsoleModal teleports to body, so its buttons live outside the wrapper. */
function exportConfirmButton(): DOMWrapper<Element> {
  const confirm = new DOMWrapper(document.body)
    .findAll('[role="dialog"] button')
    .find((button) => button.text() === 'Confirm')
  if (!confirm) throw new Error('expected the export confirm action')
  return confirm
}

async function confirmExport(): Promise<void> {
  await exportConfirmButton().trigger('click')
  await settleLogRequests()
}

describe('LogsView', () => {
  it('renders seven grouped desktop columns with separate usage and cost', async () => {
    const wrapper = mount(LogsView, {
      global: { plugins: [i18n] },
    })

    await settleLogRequests()

    const headers = wrapper
      .findAll('.data-table-header-clip thead td')
      .map((header) => header.text())
    expect(headers).toEqual([
      'Time',
      'Token / type',
      'Model / channel',
      'Performance',
      'Usage',
      'Cost',
      'Detail',
    ])
  })

  it('keeps all seven grouped columns available from the desktop column settings', async () => {
    const wrapper = mount(LogsView, {
      global: { plugins: [i18n] },
    })

    await settleLogRequests()
    const trigger = wrapper.get('button[aria-label="Columns"]')
    await trigger.trigger('click')

    const panel = wrapper.get(`#${trigger.attributes('aria-controls')}`)
    expect(panel.text()).toContain('Time')
    expect(panel.text()).toContain('Token / type')
    expect(panel.text()).toContain('Model / channel')
    expect(panel.text()).toContain('Performance')
    expect(panel.text()).toContain('Usage')
    expect(panel.text()).toContain('Cost')
    expect(panel.text()).toContain('Detail')
  })

  it('exports every filtered page as CSV, not just the visible one', async () => {
    const captured = captureDownload()
    const wrapper = mount(LogsView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await settleLogRequests()

    await openExportDialog(wrapper)
    await confirmExport()

    expect(captured.blobs).toHaveLength(1)
    expect(captured.names[0]).toMatch(/^ren2hub-logs-\d{4}-\d{2}-\d{2}\.csv$/)

    const csv = await readBlob(captured.blobs[0]!)
    const lines = csv.replace(/^\uFEFF/, '').split('\n')
    // Header plus every seeded row — the table itself only shows one page.
    expect(lines).toHaveLength(logs.length + 1)
    expect(lines[0]).toContain('"time","token","type"')
    expect(useToast().toasts.map((toast) => toast.message)).toContain(
      `Exported ${logs.length} records`
    )
  })

  it('caps a large export and says so instead of hanging the tab', async () => {
    const captured = captureDownload()
    const wrapper = mount(LogsView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await settleLogRequests()

    // Claim a ledger far past the ceiling; each page returns one row so the
    // request count is what proves the loop is bounded.
    const originalGet = api.get.bind(api)
    let exportRequests = 0
    vi.spyOn(api, 'get').mockImplementation((<T>(
      url: string,
      params?: Record<string, unknown>,
      options?: unknown
    ) => {
      if (url !== '/api/log/self') {
        return originalGet<T>(url, params, options as never)
      }
      exportRequests += 1
      return Promise.resolve({
        items: [{ ...logs[0]!, id: exportRequests }],
        total: 250_000,
        page: Number(params?.page ?? 1),
        pageSize: Number(params?.page_size ?? 100),
      } as T)
    }) as typeof api.get)

    await openExportDialog(wrapper)
    await confirmExport()

    // 10_000 row ceiling / 100 per page = 100 requests, and no more.
    expect(exportRequests).toBe(100)
    expect(useToast().toasts.map((toast) => toast.message)).toContain(
      'Over the 10000 row limit — exported the first 100. Narrow the filters.'
    )
    expect(captured.blobs).toHaveLength(1)
  })

  it('treats an unmount mid-export as a cancellation, not a failure', async () => {
    captureDownload()
    const wrapper = mount(LogsView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await settleLogRequests()

    const originalGet = api.get.bind(api)
    let rejectExport: ((reason: Error) => void) | undefined
    vi.spyOn(api, 'get').mockImplementation((<T>(
      url: string,
      params?: Record<string, unknown>,
      options?: unknown
    ) => {
      if (url !== '/api/log/self') {
        return originalGet<T>(url, params, options as never)
      }
      const signal = (options as { signal?: AbortSignal } | undefined)?.signal
      return new Promise<T>((_resolve, reject) => {
        rejectExport = reject
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        )
      })
    }) as typeof api.get)

    await openExportDialog(wrapper)
    void exportConfirmButton().trigger('click')
    await flushPromises()

    wrapper.unmount()
    await flushPromises()

    expect(rejectExport).toBeDefined()
    expect(useToast().toasts).toHaveLength(0)
  })

  it('aborts the summary request on unmount without reporting a failure', async () => {
    const originalGet = api.get.bind(api)
    let statSignal: AbortSignal | undefined
    vi.spyOn(api, 'get').mockImplementation((<T>(
      url: string,
      params?: Record<string, unknown>,
      options?: { signal?: AbortSignal }
    ) => {
      if (url !== '/api/log/self/stat') {
        return originalGet<T>(url, params, options)
      }
      statSignal = options?.signal
      return new Promise<T>((_resolve, reject) => {
        statSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        )
      })
    }) as typeof api.get)

    const wrapper = mount(LogsView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    wrapper.unmount()
    await flushPromises()

    expect(statSignal?.aborted).toBe(true)
    expect(useToast().toasts).toHaveLength(0)
  })
})
