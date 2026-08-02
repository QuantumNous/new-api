import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import * as recallApi from '../api'
import type {
  RecallMetricCard,
  RecallMetricFilters,
  RecallMetricKey,
  RecallMetricResult,
} from '../types'

const originalGlobalPropertyDescriptors = new Map<
  PropertyKey,
  PropertyDescriptor | undefined
>()

function defineTestGlobal(key: PropertyKey, value: unknown) {
  if (!originalGlobalPropertyDescriptors.has(key)) {
    originalGlobalPropertyDescriptors.set(
      key,
      Object.getOwnPropertyDescriptor(globalThis, key)
    )
  }
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
    writable: true,
  })
}

function restoreTestGlobals() {
  for (const [key, descriptor] of originalGlobalPropertyDescriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
}

function setupDom() {
  if (typeof document !== 'undefined' && document.body) {
    defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    return
  }

  class NodeShim {
    childNodes: NodeShim[] = []
    nodeType = 0
    nodeName = ''
    parentNode: NodeShim | null = null
    private listeners: Record<string, EventListener[]> = {}
    appendChild(node: NodeShim) {
      this.childNodes.push(node)
      node.parentNode = this
      return node
    }
    insertBefore(node: NodeShim, before: NodeShim | null) {
      if (!before) return this.appendChild(node)
      const index = this.childNodes.indexOf(before)
      if (index === -1) return this.appendChild(node)
      this.childNodes.splice(index, 0, node)
      node.parentNode = this
      return node
    }
    removeChild(node: NodeShim) {
      this.childNodes = this.childNodes.filter((child) => child !== node)
      node.parentNode = null
      return node
    }
    addEventListener(type: string, listener: EventListener) {
      this.listeners[type] ??= []
      this.listeners[type].push(listener)
    }
    removeEventListener(type: string, listener: EventListener) {
      this.listeners[type] = (this.listeners[type] ?? []).filter(
        (current) => current !== listener
      )
    }
    dispatchEvent(event: Event) {
      if (!('target' in event) || event.target === null) {
        Object.defineProperty(event, 'target', { value: this })
      }
      Object.defineProperty(event, 'currentTarget', {
        configurable: true,
        value: this,
      })
      for (const listener of this.listeners[event.type] ?? []) {
        listener.call(this, event)
      }
      if (event.bubbles && this.parentNode) {
        this.parentNode.dispatchEvent(event)
      }
      return !event.defaultPrevented
    }
  }
  class ElementShim extends NodeShim {
    attributes: Record<string, string> = {}
    disabled = false
    localName: string
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    style = {}
    tagName: string
    value = ''
    private text = ''
    constructor(tagName: string) {
      super()
      this.nodeType = 1
      this.localName = tagName
      this.tagName = tagName.toUpperCase()
      this.nodeName = this.tagName
    }
    set textContent(value: string) {
      this.text = String(value)
      this.childNodes = []
    }
    get textContent() {
      return (
        this.text ||
        this.childNodes
          .map((node) => ('textContent' in node ? node.textContent : ''))
          .join('')
      )
    }
    get length() {
      return this.childNodes.length
    }
    get options() {
      return this.childNodes
    }
    item(index: number) {
      return this.childNodes[index] ?? null
    }
    setAttribute(key: string, value: string) {
      this.attributes[key] = String(value)
      if (key === 'disabled') this.disabled = true
      if (key === 'value') this.value = String(value)
    }
    getAttribute(key: string) {
      return this.attributes[key] ?? null
    }
    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
    }
    querySelector(selector: string): ElementShim | null {
      if (
        selector.startsWith('#') &&
        this.attributes.id === selector.slice(1)
      ) {
        return this
      }
      if (selector.toUpperCase() === this.tagName) return this
      for (const child of this.childNodes) {
        if (child instanceof ElementShim) {
          const match = child.querySelector(selector)
          if (match) return match
        }
      }
      return null
    }
    click() {
      if (this.tagName === 'A' && anchorClickThrows) {
        throw new Error('safe click failure')
      }
    }
    focus() {}
  }
  class TextShim extends NodeShim {
    textContent: string
    constructor(text: string) {
      super()
      this.nodeType = 3
      this.nodeName = '#text'
      this.textContent = text
    }
  }
  const body = new ElementShim('body')
  const documentShim = {
    nodeType: 9,
    body,
    createElement: (tagName: string) => {
      const element = new ElementShim(tagName)
      Object.assign(element, { ownerDocument: documentShim })
      return element
    },
    createElementNS: (_namespace: string, tagName: string) => {
      const element = new ElementShim(tagName)
      Object.assign(element, { ownerDocument: documentShim })
      return element
    },
    createTextNode: (text: string) => new TextShim(text),
    addEventListener() {},
    removeEventListener() {},
    defaultView: globalThis,
  }
  Object.assign(body, { ownerDocument: documentShim })
  const appendToBody = body.appendChild.bind(body)
  body.appendChild = (node: NodeShim) => {
    const appended = appendToBody(node)
    if (node instanceof ElementShim && node.tagName === 'A') {
      node.click = () => {
        if (anchorClickThrows) throw new Error('safe click failure')
      }
    }
    return appended
  }
  defineTestGlobal('document', documentShim as unknown as Document)
  defineTestGlobal(
    'window',
    globalThis as unknown as Window & typeof globalThis
  )
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('MouseEvent', Event)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  defineTestGlobal('URL', {
    createObjectURL: () => {
      objectUrls.push('blob:test')
      return 'blob:test'
    },
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url)
    },
  })
}

setupDom()

const metricUserCalls: Array<{
  metric: RecallMetricKey
  filters: RecallMetricFilters
}> = []
const exportCalls: Array<{
  metric: RecallMetricKey
  filters: RecallMetricFilters
}> = []
const objectUrls: string[] = []
const revokedUrls: string[] = []

const defaultResult: RecallMetricResult = {
  items: [],
  total: 0,
  amounts: [],
  snapshot: 'default-page-snapshot',
  legacy_unidentified_count: 0,
  drilldown_complete: true,
}

const pages: Record<string, RecallMetricResult[]> = {
  messages_accepted: [
    {
      items: [
        {
          row_id: 1,
          recipient_id: 11,
          message_id: 101,
          user_id: 501,
          email: 'accepted@example.com',
          occurred_at: 1_900_000_000,
          stage_no: 1,
          state: 'accepted',
          conversion_kind: '',
          trade_no: '',
          payment_category: '',
          currency: '',
          amount_minor: 0,
          failure_code: '',
        },
      ],
      total: 2,
      amounts: [],
      snapshot: 'accepted-page-snapshot',
      next_cursor: 'accepted-next',
      legacy_unidentified_count: 3,
      drilldown_complete: false,
    },
  ],
  messages_failed: [
    {
      items: [
        {
          row_id: 2,
          recipient_id: 12,
          message_id: 102,
          user_id: 502,
          email: 'masked-from-backend',
          occurred_at: 1_900_000_100,
          stage_no: 2,
          state: 'failed',
          conversion_kind: '',
          trade_no: '',
          payment_category: '',
          currency: '',
          amount_minor: 0,
          failure_code: 'smtp_rejected',
        },
      ],
      total: 1,
      amounts: [],
      snapshot: 'failed-page-snapshot',
      legacy_unidentified_count: 0,
      drilldown_complete: true,
    },
  ],
  candidates: [
    {
      items: [
        {
          row_id: 10,
          recipient_id: 20,
          message_id: 0,
          user_id: 601,
          email: 'candidate@example.com',
          occurred_at: 1_900_000_200,
          stage_no: 0,
          state: 'queued',
          conversion_kind: '',
          trade_no: '',
          payment_category: '',
          currency: '',
          amount_minor: 0,
          failure_code: '',
        },
      ],
      total: 1,
      amounts: [],
      snapshot: 'candidate-page-snapshot',
      legacy_unidentified_count: 0,
      drilldown_complete: true,
    },
  ],
  attributed_spend: [
    {
      items: [
        {
          row_id: 20,
          recipient_id: 30,
          message_id: 0,
          user_id: 701,
          email: 'first-spend@example.com',
          occurred_at: 1_900_000_300,
          stage_no: 0,
          state: 'converted',
          conversion_kind: 'direct',
          trade_no: 'trade_1',
          payment_category: 'direct_topup',
          currency: 'usd',
          amount_minor: 9_600,
          failure_code: '',
        },
      ],
      total: 2,
      amounts: [{ currency: 'USD', amount_minor: 9_600, user_count: 2 }],
      snapshot: 'spend-page-snapshot',
      next_cursor: 'spend-next',
      legacy_unidentified_count: 0,
      drilldown_complete: true,
    },
    {
      items: [
        {
          row_id: 21,
          recipient_id: 31,
          message_id: 0,
          user_id: 702,
          email: 'second-spend@example.com',
          occurred_at: 1_900_000_301,
          stage_no: 0,
          state: 'converted',
          conversion_kind: 'assisted',
          trade_no: 'trade_2',
          payment_category: 'online_subscription',
          currency: 'USD',
          amount_minor: 4_200,
          failure_code: '',
        },
      ],
      total: 2,
      amounts: [{ currency: 'USD', amount_minor: 9_600, user_count: 2 }],
      snapshot: 'spend-page-snapshot',
      legacy_unidentified_count: 0,
      drilldown_complete: true,
    },
  ],
  direct_topup: [
    {
      items: [
        {
          row_id: 30,
          recipient_id: 40,
          message_id: 0,
          user_id: 801,
          email: 'unknown-currency@example.com',
          occurred_at: 1_900_000_400,
          stage_no: 0,
          state: 'converted',
          conversion_kind: 'direct',
          trade_no: 'trade_unknown',
          payment_category: 'direct_topup',
          currency: 'UNKNOWN',
          amount_minor: 9_600,
          failure_code: '',
        },
      ],
      total: 1,
      amounts: [{ currency: 'UNKNOWN', amount_minor: 9_600, user_count: 1 }],
      snapshot: 'unknown-page-snapshot',
      legacy_unidentified_count: 0,
      drilldown_complete: true,
    },
  ],
}
let pendingMetricRequest: {
  metric: RecallMetricKey
  filters: RecallMetricFilters
  resolve: (value: { success: true; data: RecallMetricResult }) => void
  reject?: (error: Error) => void
} | null = null
let metricUserError: Error | null = null
let exportError: Error | null = null
let anchorClickThrows = false

mock.module('../api', () => ({
  ...recallApi,
  exportRecallCampaignMetricUsers: async (
    _campaignId: number,
    metric: RecallMetricKey,
    filters: RecallMetricFilters
  ) => {
    exportCalls.push({ metric, filters })
    if (exportError) throw exportError
    return new Blob(['ok'], { type: 'text/csv' })
  },
  getRecallCampaignMetricUsers: async (
    _campaignId: number,
    metric: RecallMetricKey,
    filters: RecallMetricFilters
  ) => {
    metricUserCalls.push({ metric, filters })
    if (pendingMetricRequest?.metric === metric) {
      return await new Promise<{ success: true; data: RecallMetricResult }>(
        (resolve, reject) => {
          pendingMetricRequest = { metric, filters, resolve, reject }
        }
      )
    }
    if (metricUserError) throw metricUserError
    const pageIndex = filters.cursor ? 1 : 0
    return {
      success: true,
      data: pages[metric]?.[pageIndex] ?? pages[metric]?.[0] ?? defaultResult,
    }
  },
  recallCampaignKeys: {
    ...recallApi.recallCampaignKeys,
    metricUsers: (
      campaignId: number,
      metric: RecallMetricKey,
      filters: RecallMetricFilters
    ) => ['recall-campaigns', campaignId, 'metric-users', metric, filters],
  },
}))

const inputProps: Record<
  string,
  React.InputHTMLAttributes<HTMLInputElement>
> = {}
const buttonProps: Record<
  string,
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = {}

mock.module('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    if (typeof props.children === 'string') buttonProps[props.children] = props
    return <button {...props} />
  },
}))

mock.module('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    if (props.id) inputProps[props.id] = props
    return <input {...props} />
  },
}))

mock.module('@/components/ui/native-select', () => ({
  NativeSelect: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => {
    if (props.id) {
      inputProps[props.id] =
        props as unknown as React.InputHTMLAttributes<HTMLInputElement>
    }
    return <select {...props} />
  },
  NativeSelectOption: (
    props: React.OptionHTMLAttributes<HTMLOptionElement>
  ) => <option {...props} />,
}))

mock.module('@/components/ui/sheet', () => ({
  Sheet: (props: { open?: boolean; children: React.ReactNode }) =>
    props.open ? <div data-testid='sheet'>{props.children}</div> : null,
  SheetContent: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <section {...props} />
  ),
  SheetDescription: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} />
  ),
  SheetHeader: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <header {...props} />
  ),
  SheetTitle: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} />
  ),
}))

mock.module('@/components/ui/table', () => ({
  Table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <table {...props} />
  ),
  TableBody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody {...props} />
  ),
  TableCell: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td {...props} />
  ),
  TableHead: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th {...props} />
  ),
  TableHeader: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} />
  ),
  TableRow: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr {...props} />
  ),
}))

const { CampaignMetricCardSection } = await import('./campaign-metric-drawer')

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'Recipient status': 'Recipient status',
        converted: 'Paid recipient',
        direct: 'Own-link attribution',
        assisted: 'Follow-up attribution',
      },
    },
  },
  interpolation: { escapeValue: false },
})

function makeCard(
  key: RecallMetricKey,
  total: number,
  snapshot: string,
  rowGrain = 'message',
  supportedFilters: Record<string, boolean> = { search: true, stage_no: true }
): RecallMetricCard {
  return {
    key,
    total,
    amounts: [],
    row_grain: rowGrain,
    snapshot,
    legacy_unidentified_count: key === 'messages_accepted' ? 3 : 0,
    drilldown_complete: key !== 'messages_accepted',
    supported_filters: supportedFilters,
  }
}

function makeAmountCard(
  key: RecallMetricKey,
  snapshot: string,
  amountMinor: number,
  userCount: number
): RecallMetricCard {
  return {
    ...makeCard(key, userCount, snapshot, 'conversion', {
      search: true,
      currency: true,
      conversion_kind: true,
      payment_category: true,
    }),
    amounts: [
      { currency: 'USD', amount_minor: amountMinor, user_count: userCount },
    ],
  }
}

function renderSection(cards: Record<string, RecallMetricCard>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  React.act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <CampaignMetricCardSection campaignId={42} metricCards={cards} />
        </I18nextProvider>
      </QueryClientProvider>
    )
  })
  return { container, root }
}

async function wait(ms = 0) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function click(label: string) {
  await React.act(async () => {
    buttonProps[label]?.onClick?.(
      new MouseEvent('click') as unknown as React.MouseEvent<HTMLButtonElement>
    )
    await wait()
  })
}

afterEach(() => {
  metricUserCalls.length = 0
  exportCalls.length = 0
  objectUrls.length = 0
  revokedUrls.length = 0
  pendingMetricRequest = null
  metricUserError = null
  exportError = null
  anchorClickThrows = false
  for (const key of Object.keys(inputProps)) delete inputProps[key]
  for (const key of Object.keys(buttonProps)) delete buttonProps[key]
})

afterAll(() => {
  mock.restore()
  restoreTestGlobals()
})

describe('CampaignMetricCardSection', () => {
  test('opens a shared drawer from a metric card and preserves the card snapshot across filter/export actions', async () => {
    const { container, root } = renderSection({
      messages_accepted: makeCard(
        'messages_accepted',
        2,
        'accepted-card-snapshot'
      ),
      messages_failed: makeCard('messages_failed', 1, 'failed-card-snapshot'),
    })

    await click('Accepted messages')

    expect(container.textContent).toContain('Accepted messages')
    expect(container.textContent).toContain('Message rows')
    expect(container.textContent).toContain(
      'Historical excluded identities were not recorded'
    )
    expect(container.textContent).toContain('3')
    expect(metricUserCalls[0]).toEqual({
      metric: 'messages_accepted',
      filters: { limit: 50, snapshot: 'accepted-card-snapshot' },
    })

    await React.act(async () => {
      inputProps['recall-metric-search']?.onChange?.({
        target: { value: '501' },
      } as React.ChangeEvent<HTMLInputElement>)
      await wait()
    })

    expect(metricUserCalls.at(-1)).toEqual({
      metric: 'messages_accepted',
      filters: { limit: 50, q: '501', snapshot: 'accepted-card-snapshot' },
    })

    await click('Download current results')

    expect(exportCalls.at(-1)).toEqual({
      metric: 'messages_accepted',
      filters: { q: '501', snapshot: 'accepted-card-snapshot' },
    })

    React.act(() => root.unmount())
  })

  test('keeps accepted and failed message exports as separate metric calls', async () => {
    const { root } = renderSection({
      messages_accepted: makeCard(
        'messages_accepted',
        2,
        'accepted-card-snapshot'
      ),
      messages_failed: makeCard('messages_failed', 1, 'failed-card-snapshot'),
    })

    await click('Accepted messages')
    await click('Download current results')
    await click('Failed messages')
    await click('Download current results')

    expect(exportCalls.map((call) => call.metric)).toEqual([
      'messages_accepted',
      'messages_failed',
    ])
    expect(exportCalls.map((call) => call.filters.snapshot)).toEqual([
      'accepted-card-snapshot',
      'failed-card-snapshot',
    ])

    React.act(() => root.unmount())
  })

  test('uses user-facing column and payment labels instead of API field names', async () => {
    const { container, root } = renderSection({
      attributed_spend: makeAmountCard(
        'attributed_spend',
        'spend-card-snapshot',
        9_600,
        2
      ),
    })

    await click('Attributed spend')
    await React.act(async () => {
      await wait()
    })

    expect(container.textContent).toContain('User ID')
    expect(container.textContent).toContain('Email')
    expect(container.textContent).toContain('Occurred at')
    expect(container.textContent).toContain('Recipient status')
    expect(container.textContent).toContain('Trade number')
    expect(container.textContent).toContain('Currency')
    expect(container.textContent).toContain('Conversion amount')
    expect(container.textContent).toContain('Paid recipient')
    expect(container.textContent).toContain('Own-link attribution')
    expect(container.textContent).toContain('USD')
    expect(container.textContent).toContain('Direct top-up')
    expect(container.textContent).toContain('Unclassified attributed spend')
    expect(container.textContent).not.toContain('user_id')
    expect(container.textContent).not.toContain('email')
    expect(container.textContent).not.toContain('state')
    expect(container.textContent).not.toContain('currency')
    expect(container.textContent).not.toContain('State')
    expect(container.textContent).not.toContain('Amount')
    expect(container.textContent).not.toContain('converted')
    expect(container.textContent).not.toContain('direct')
    expect(container.textContent).not.toContain('usd')
    expect(container.textContent).not.toContain('direct_topup')
    expect(container.textContent).not.toContain('unclassified')

    React.act(() => root.unmount())
  })

  test('prunes unsupported filters and resets snapshot when switching metric cards', async () => {
    const { root } = renderSection({
      attributed_spend: makeAmountCard(
        'attributed_spend',
        'spend-card-snapshot',
        9_600,
        2
      ),
      candidates: makeCard(
        'candidates',
        1,
        'candidate-card-snapshot',
        'identity',
        {
          search: true,
        }
      ),
    })

    await click('Attributed spend')
    await React.act(async () => {
      inputProps['recall-metric-currency']?.onChange?.({
        target: { value: 'USD' },
      } as React.ChangeEvent<HTMLInputElement>)
      inputProps['recall-metric-conversion-kind']?.onChange?.({
        target: { value: 'direct' },
      } as React.ChangeEvent<HTMLInputElement>)
      await wait()
    })
    expect(metricUserCalls.at(-1)?.filters).toEqual({
      conversion_kind: 'direct',
      currency: 'USD',
      limit: 50,
      snapshot: 'spend-card-snapshot',
    })

    await click('Candidates')
    expect(metricUserCalls.at(-1)).toEqual({
      metric: 'candidates',
      filters: { limit: 50, snapshot: 'candidate-card-snapshot' },
    })

    await click('Download current results')
    expect(exportCalls.at(-1)).toEqual({
      metric: 'candidates',
      filters: { snapshot: 'candidate-card-snapshot' },
    })

    React.act(() => root.unmount())
  })

  test('uses next_cursor for pagination, appends rows, and blocks duplicate page clicks while pending', async () => {
    const { container, root } = renderSection({
      attributed_spend: makeAmountCard(
        'attributed_spend',
        'spend-card-snapshot',
        9_600,
        2
      ),
    })

    await click('Attributed spend')
    await React.act(async () => {
      await wait()
    })
    expect(container.textContent).toContain('701')
    expect(container.textContent).not.toContain('702')

    pendingMetricRequest = {
      metric: 'attributed_spend',
      filters: {},
      resolve: () => undefined,
    }
    await click('Load more')
    await click('Load more')
    expect(
      metricUserCalls.filter((call) => call.filters.cursor === 'spend-next')
    ).toHaveLength(1)

    await React.act(async () => {
      pendingMetricRequest?.resolve({
        success: true,
        data: pages.attributed_spend[1],
      })
      await wait()
    })
    expect(container.textContent).toContain('701')
    expect(container.textContent).toContain('702')

    React.act(() => root.unmount())
  })

  test('shows loading, empty, initial error, and retries metric row loads safely', async () => {
    pendingMetricRequest = {
      metric: 'messages_failed',
      filters: {},
      resolve: () => undefined,
    }
    const { container, root } = renderSection({
      messages_failed: makeCard('messages_failed', 1, 'failed-card-snapshot'),
    })

    await click('Failed messages')
    expect(container.textContent).toContain('Loading metric rows')

    await React.act(async () => {
      pendingMetricRequest?.reject?.(new Error('raw backend metric failure'))
      pendingMetricRequest = null
      await wait()
    })
    expect(container.textContent).toContain('Unable to load metric rows.')
    expect(container.textContent).not.toContain('raw backend metric failure')

    await click('Retry')
    expect(metricUserCalls.at(-1)).toEqual({
      metric: 'messages_failed',
      filters: { limit: 50, snapshot: 'failed-card-snapshot' },
    })

    await React.act(async () => {
      await wait()
    })
    expect(container.textContent).toContain('502')

    React.act(() => root.unmount())

    const empty = renderSection({
      enrolled: makeCard('enrolled', 0, 'enrolled-card-snapshot', 'identity'),
    })
    await click('Enrolled')
    await React.act(async () => {
      await wait()
    })
    expect(empty.container.textContent).toContain('No metric rows found.')

    React.act(() => empty.root.unmount())
  })

  test('keeps loaded rows and retries the same cursor after load-more failure', async () => {
    const { container, root } = renderSection({
      attributed_spend: makeAmountCard(
        'attributed_spend',
        'spend-card-snapshot',
        9_600,
        2
      ),
    })

    await click('Attributed spend')
    await React.act(async () => {
      await wait()
    })
    expect(container.textContent).toContain('701')

    pendingMetricRequest = {
      metric: 'attributed_spend',
      filters: {},
      resolve: () => undefined,
    }
    await click('Load more')
    await React.act(async () => {
      pendingMetricRequest?.reject?.(new Error('raw cursor failure'))
      pendingMetricRequest = null
      await wait()
    })

    expect(container.textContent).toContain('701')
    expect(container.textContent).not.toContain('702')
    expect(container.textContent).toContain('Unable to load metric rows.')
    expect(container.textContent).not.toContain('raw cursor failure')

    await click('Retry')
    await React.act(async () => {
      await wait()
    })

    expect(
      metricUserCalls.filter((call) => call.filters.cursor === 'spend-next')
    ).toHaveLength(2)
    expect(container.textContent).toContain('701')
    expect(container.textContent).toContain('702')

    React.act(() => root.unmount())
  })

  test('shows export failures safely, preserves filters, and revokes object URLs when click throws', async () => {
    const { container, root } = renderSection({
      messages_failed: makeCard('messages_failed', 1, 'failed-card-snapshot'),
    })

    await click('Failed messages')
    await React.act(async () => {
      inputProps['recall-metric-search']?.onChange?.({
        target: { value: '502' },
      } as React.ChangeEvent<HTMLInputElement>)
      await wait()
    })

    exportError = new Error('raw export failure')
    await click('Download current results')
    expect(container.textContent).toContain('Unable to download metric rows.')
    expect(container.textContent).not.toContain('raw export failure')
    expect(buttonProps['Download current results']?.disabled).toBeFalse()

    exportError = null
    anchorClickThrows = true
    await click('Download current results')

    expect(exportCalls.at(-1)).toEqual({
      metric: 'messages_failed',
      filters: { q: '502', snapshot: 'failed-card-snapshot' },
    })
    expect(objectUrls).toEqual(['blob:test'])
    expect(revokedUrls).toEqual(['blob:test'])

    React.act(() => root.unmount())
  })

  test('renders supported filter controls from metadata, including state only when declared', async () => {
    const { container, root } = renderSection({
      candidates: makeCard(
        'candidates',
        1,
        'candidate-card-snapshot',
        'identity',
        {
          search: true,
          state: true,
        }
      ),
      messages_accepted: makeCard(
        'messages_accepted',
        2,
        'accepted-card-snapshot',
        'message',
        { search: true, stage_no: true }
      ),
    })

    await click('Accepted messages')
    expect(container.textContent).toContain('Stage')
    expect(inputProps['recall-metric-state']).toBeUndefined()

    await click('Candidates')
    expect(container.textContent).toContain('Recipient status')
    expect(container.textContent).not.toContain('State')
    expect(inputProps['recall-metric-state']).toBeTruthy()
    await React.act(async () => {
      inputProps['recall-metric-state']?.onChange?.({
        target: { value: 'queued' },
      } as React.ChangeEvent<HTMLInputElement>)
      await wait()
    })
    expect(metricUserCalls.at(-1)?.filters).toEqual({
      limit: 50,
      snapshot: 'candidate-card-snapshot',
      state: 'queued',
    })

    React.act(() => root.unmount())
  })

  test('formats amount cards with money and user counts without merging currencies', () => {
    const { container, root } = renderSection({
      attributed_spend: makeAmountCard(
        'attributed_spend',
        'spend-card-snapshot',
        9_600,
        2
      ),
      new_external_cash: makeAmountCard(
        'new_external_cash',
        'cash-card-snapshot',
        1_600,
        1
      ),
      direct_topup: {
        ...makeAmountCard('direct_topup', 'topup-card-snapshot', 9_600, 3),
        amounts: [
          { currency: 'USD', amount_minor: 9_600, user_count: 2 },
          { currency: 'JPY', amount_minor: 1_600, user_count: 1 },
        ],
      },
    })

    expect(container.textContent).toContain('$96.00 / 2')
    expect(container.textContent).toContain('$16.00 / 1')
    expect(container.textContent).toContain('¥1,600 / 1')

    React.act(() => root.unmount())
  })

  test('formats zero, negative, and unknown currency amounts without blank count-only values', async () => {
    const { container, root } = renderSection({
      attributed_spend: {
        ...makeAmountCard('attributed_spend', 'spend-card-snapshot', 0, 2),
        amounts: [
          { currency: 'USD', amount_minor: 0, user_count: 2 },
          { currency: 'JPY', amount_minor: -1_600, user_count: 1 },
        ],
      },
      direct_topup: {
        ...makeAmountCard('direct_topup', 'unknown-card-snapshot', 9_600, 1),
        amounts: [{ currency: 'UNKNOWN', amount_minor: 9_600, user_count: 1 }],
      },
    })

    expect(container.textContent).toContain('$0.00 / 2')
    expect(container.textContent).toContain('-¥1,600 / 1')
    expect(container.textContent).toContain('UNKNOWN 9600 minor units / 1')

    await click('Direct top-up')
    await React.act(async () => {
      await wait()
    })
    expect(container.textContent).toContain('UNKNOWN 9600 minor units')

    React.act(() => root.unmount())
  })
})
