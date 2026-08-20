import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { PlanRecord, SubscriptionPayResponse } from '../../types'

type ButtonProps = {
  children?: React.ReactNode
  disabled?: boolean
  onClick?: () => void | Promise<void>
}

type SelectProps = {
  disabled?: boolean
  onValueChange?: (value: string | null) => void
  value?: string
}

const epayCalls: Array<{
  payment_method: string
  plan_id: number
  request_id: string
}> = []
const stripeCalls: Array<{
  plan_id: number
  request_id?: string
}> = []
let latestSelectProps: SelectProps | undefined
let latestButtonProps: ButtonProps[] = []
let requestIdSeed = 0

const paySubscriptionEpay = mock(
  async (data: {
    payment_method: string
    plan_id: number
    request_id: string
  }): Promise<SubscriptionPayResponse & { url?: string }> => {
    epayCalls.push(data)
    return {
      success: true,
      message: 'success',
      url: 'https://pay.example.test',
      data: {},
    }
  }
)
const paySubscriptionStripe = mock(
  async (data: { plan_id: number; request_id?: string }) => {
    stripeCalls.push(data)
    return {
      success: true,
      message: 'success',
      data: { pay_link: 'https://stripe.example.test' },
    }
  }
)

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
  class NodeShim {
    childNodes: NodeShim[] = []
    nodeType = 0
    nodeName = ''
    parentNode: NodeShim | null = null
    ownerDocument = globalThis.document

    appendChild(node: NodeShim) {
      this.childNodes.push(node)
      node.parentNode = this
      return node
    }

    insertBefore(node: NodeShim, before: NodeShim | null) {
      const index = before ? this.childNodes.indexOf(before) : -1
      if (index < 0) return this.appendChild(node)
      this.childNodes.splice(index, 0, node)
      node.parentNode = this
      return node
    }

    removeChild(node: NodeShim) {
      this.childNodes = this.childNodes.filter((child) => child !== node)
      node.parentNode = null
      return node
    }

    addEventListener() {}
    removeEventListener() {}
  }

  class ElementShim extends NodeShim {
    attributes: Record<string, string> = {}
    disabled = false
    localName: string
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    style = {}
    tagName: string
    type = ''
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

    setAttribute(key: string, value: string) {
      this.attributes[key] = String(value)
      if (key === 'disabled') this.disabled = true
      if (key === 'value') this.value = String(value)
    }

    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
    }

    submit() {}
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
  const head = new ElementShim('head')
  const shimDocument = {
    nodeType: 9,
    body,
    head,
    createElement: (tagName: string) => new ElementShim(tagName),
    createElementNS: (_namespace: string, tagName: string) =>
      new ElementShim(tagName),
    createTextNode: (text: string) => new TextShim(text),
    getElementsByTagName: (tagName: string) =>
      tagName.toLowerCase() === 'head' ? [head] : [],
    addEventListener() {},
    removeEventListener() {},
    defaultView: globalThis,
  }
  defineTestGlobal('document', shimDocument as unknown as Document)
  defineTestGlobal(
    'window',
    Object.assign(globalThis, {
      location: { href: 'http://localhost/subscriptions' },
    }) as unknown as Window & typeof globalThis
  )
  defineTestGlobal('navigator', { userAgent: 'Chrome' } as Navigator)
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  defineTestGlobal('crypto', {
    randomUUID: () => `request-${++requestIdSeed}`,
  })
}

setupDom()

mock.module('../../api', () => ({
  paySubscriptionBalance: mock(async () => ({ success: true })),
  paySubscriptionCreem: mock(async () => ({ success: true })),
  paySubscriptionEpay,
  paySubscriptionStripe,
  paySubscriptionWaffoPancake: mock(async () => ({ success: true })),
}))

mock.module('../../api.ts', () => ({
  paySubscriptionBalance: mock(async () => ({ success: true })),
  paySubscriptionCreem: mock(async () => ({ success: true })),
  paySubscriptionEpay,
  paySubscriptionStripe,
  paySubscriptionWaffoPancake: mock(async () => ({ success: true })),
}))

mock.module('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ currency: { quotaPerUnit: 500000 } }),
}))

mock.module('@/stores/system-config-store', () => ({
  DEFAULT_CURRENCY_CONFIG: {
    displayInCurrency: true,
    quotaDisplayType: 'USD',
    quotaPerUnit: 500000,
    usdExchangeRate: 1,
    customCurrencySymbol: '¤',
    customCurrencyExchangeRate: 1,
  },
  useSystemConfigStore: {
    getState: () => ({
      config: {
        currency: {
          displayInCurrency: true,
          quotaDisplayType: 'USD',
          quotaPerUnit: 500000,
          usdExchangeRate: 1,
          customCurrencySymbol: '¤',
          customCurrencyExchangeRate: 1,
        },
      },
    }),
  },
}))

mock.module('@/lib/analytics/gtag', () => ({
  getGAMeasurementIdentifiers: () => ({}),
}))

mock.module('../../lib', () => ({
  formatDuration: () => '1 month',
  formatMediaValue: () => '',
  formatResetPeriod: () => 'No Reset',
}))

mock.module('@/features/wallet/lib/recall-claim', () => ({
  isRecallPriceEligible: () => false,
  validateRecallClaim: mock(async () => ({ success: false })),
}))

mock.module('sonner', () => ({
  toast: {
    error: mock(() => undefined),
    success: mock(() => undefined),
  },
}))

mock.module('lucide-react', () => ({
  AlertCircle: () => null,
  CalendarClock: () => null,
  Check: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Copy: () => null,
  Crown: () => null,
  ExternalLink: () => null,
  FileText: () => null,
  Loader2: () => null,
  Package: () => null,
  RefreshCw: () => null,
  Search: () => null,
}))

mock.module('@/components/dialog', () => ({
  Dialog: (props: { children: React.ReactNode; open?: boolean }) =>
    props.open ? <div>{props.children}</div> : null,
}))

mock.module('@/components/ui/alert', () => ({
  Alert: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  AlertDescription: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

mock.module('@/components/ui/button', () => ({
  Button: (props: ButtonProps) => {
    latestButtonProps.push(props)
    return <button disabled={props.disabled}>{props.children}</button>
  },
}))

mock.module('@/components/ui/select', () => ({
  Select: (props: SelectProps & { children: React.ReactNode }) => {
    latestSelectProps = props
    return <div>{props.children}</div>
  },
  SelectContent: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  SelectGroup: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  SelectItem: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  SelectTrigger: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  SelectValue: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

mock.module('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

mock.module('@/components/group-badge', () => ({
  GroupBadge: () => null,
}))

const { SubscriptionPurchaseDialog } =
  await import('./subscription-purchase-dialog')
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  epayCalls.length = 0
  stripeCalls.length = 0
  latestSelectProps = undefined
  latestButtonProps = []
  requestIdSeed = 0
  paySubscriptionEpay.mockClear()
  paySubscriptionStripe.mockClear()
})

afterAll(() => {
  restoreTestGlobals()
})

function planRecord(): PlanRecord {
  return {
    plan: {
      id: 42,
      title: 'Pro',
      price_amount: 5,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      quota_reset_period: 'monthly',
      enabled: true,
      sort_order: 1,
      allow_balance_pay: false,
      max_purchase_per_user: 0,
      total_amount: 1000000,
      window_5h_amount: 0,
      window_week_amount: 0,
      media_credits_monthly: 0,
      stripe_price_id: 'price_123',
      model_count: 0,
      rpm: 0,
      concurrency: 0,
      feature_lines: '',
    },
  }
}

function renderDialog() {
  const container = document.createElement('div')
  const root = createRoot(container)

  renderDialogOpenState(root, true)

  return { root }
}

function renderDialogOpenState(root: Root, open: boolean) {
  React.act(() => {
    latestButtonProps = []
    root.render(
      <I18nextProvider i18n={testI18n}>
        <SubscriptionPurchaseDialog
          open={open}
          onOpenChange={() => undefined}
          plan={planRecord()}
          enableStripe
          enableOnlineTopUp
          epayMethods={[
            { type: 'alipay', name: 'Alipay' },
            { type: 'wechat', name: 'WeChat' },
          ]}
        />
      </I18nextProvider>
    )
  })
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
  })
}

function latestPayButton() {
  const button = [...latestButtonProps]
    .reverse()
    .find((props) => props.children === 'Pay')
  if (!button?.onClick) {
    throw new Error('Pay button was not rendered')
  }
  return button
}

function latestStripeButton() {
  const button = [...latestButtonProps]
    .reverse()
    .find((props) => props.children === 'Pay with card (Stripe)')
  if (!button?.onClick) {
    throw new Error('Stripe button was not rendered')
  }
  return button
}

describe('SubscriptionPurchaseDialog', () => {
  test('passes a stable request id to direct Stripe subscription checkout', async () => {
    const { root } = renderDialog()

    await React.act(async () => {
      await latestStripeButton().onClick?.()
    })
    await React.act(async () => {
      await latestStripeButton().onClick?.()
    })

    expect(stripeCalls).toHaveLength(2)
    expect(stripeCalls[0]?.request_id).toBe('request-1')
    expect(stripeCalls[1]?.request_id).toBe(stripeCalls[0]?.request_id)

    dispose(root)
  })

  test('rotates the Stripe request id after a definitive payment failure', async () => {
    paySubscriptionStripe.mockImplementationOnce(async (data) => {
      stripeCalls.push(data)
      return {
        success: false,
        message: 'plan unavailable',
      }
    })
    const { root } = renderDialog()

    await React.act(async () => {
      await latestStripeButton().onClick?.()
    })
    await React.act(async () => {
      await latestStripeButton().onClick?.()
    })

    expect(stripeCalls).toHaveLength(2)
    expect(stripeCalls[0]?.request_id).toBe('request-1')
    expect(stripeCalls[1]?.request_id).toBe('request-2')

    dispose(root)
  })

  test('rotates the ePay request id when the selected payment method changes', async () => {
    const { root } = renderDialog()

    await React.act(async () => {
      await latestPayButton().onClick?.()
    })
    expect(epayCalls[0]?.payment_method).toBe('alipay')

    await React.act(async () => {
      await latestPayButton().onClick?.()
    })
    expect(epayCalls[1]?.payment_method).toBe('alipay')
    expect(epayCalls[1]?.request_id).toBe(epayCalls[0]?.request_id)

    await React.act(async () => {
      latestSelectProps?.onValueChange?.('wechat')
    })
    await React.act(async () => {
      await latestPayButton().onClick?.()
    })

    expect(epayCalls).toHaveLength(3)
    expect(epayCalls[2]?.payment_method).toBe('wechat')
    expect(epayCalls[2]?.request_id).not.toBe(epayCalls[0]?.request_id)

    dispose(root)
  })

  test('rotates the ePay request id after closing and reopening the purchase dialog', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    renderDialogOpenState(root, true)

    await React.act(async () => {
      await latestPayButton().onClick?.()
    })
    renderDialogOpenState(root, false)
    renderDialogOpenState(root, true)
    await React.act(async () => {
      await latestPayButton().onClick?.()
    })

    expect(epayCalls).toHaveLength(2)
    expect(epayCalls[0]?.request_id).toBe('request-1')
    expect(epayCalls[1]?.request_id).toBe('request-2')

    dispose(root)
  })

  test('rotates the ePay request id after a definitive payment failure', async () => {
    paySubscriptionEpay.mockImplementationOnce(async (data) => {
      epayCalls.push(data)
      return {
        success: false,
        message: 'plan unavailable',
      }
    })
    const { root } = renderDialog()

    await React.act(async () => {
      await latestPayButton().onClick?.()
    })
    await React.act(async () => {
      await latestPayButton().onClick?.()
    })

    expect(epayCalls).toHaveLength(2)
    expect(epayCalls[0]?.request_id).toBe('request-1')
    expect(epayCalls[1]?.request_id).toBe('request-2')

    dispose(root)
  })

  test('keeps the ePay request id after an unknown network failure', async () => {
    paySubscriptionEpay.mockImplementationOnce(async (data) => {
      epayCalls.push(data)
      throw new Error('network timeout')
    })
    const { root } = renderDialog()

    await React.act(async () => {
      await latestPayButton().onClick?.()
    })
    await React.act(async () => {
      await latestPayButton().onClick?.()
    })

    expect(epayCalls).toHaveLength(2)
    expect(epayCalls[0]?.request_id).toBe('request-1')
    expect(epayCalls[1]?.request_id).toBe(epayCalls[0]?.request_id)

    dispose(root)
  })
})
