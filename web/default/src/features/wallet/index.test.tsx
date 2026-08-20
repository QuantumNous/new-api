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
import type { TopupInfo } from './types'
import type { WalletCheckoutSearch } from './lib'

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
    }

    removeAttribute(key: string) {
      delete this.attributes[key]
      if (key === 'disabled') this.disabled = false
    }
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
    getElementById: () => null,
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
      history: { replaceState: mock(() => undefined) },
      location: {
        href: 'http://localhost/wallet?currency=BRL',
        hash: '',
        pathname: '/wallet',
        search: '?currency=BRL',
      },
      queueMicrotask,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
      setTimeout,
      clearTimeout,
    }) as unknown as Window & typeof globalThis
  )
  defineTestGlobal('navigator', { userAgent: 'Chrome' } as Navigator)
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
}

setupDom()

mock.module('@/lib/api', () => ({
  getSelf: mock(async () => ({
    success: true,
    data: {
      id: 1,
      username: 'ada',
      quota: 0,
      used_quota: 0,
      request_count: 0,
      aff_quota: 0,
      aff_history_quota: 0,
      aff_count: 0,
      group: 'default',
    },
  })),
}))

mock.module('@/lib/analytics/gtag', () => ({
  trackAdsFunnelEvent: mock(() => undefined),
}))

mock.module('@/lib/analytics/mixpanel', () => ({
  resumeMixpanelAfterRecallClaim: mock(() => undefined),
}))

mock.module('@/lib/analytics/topup-tracking', () => ({
  trackTopupOnce: mock(() => undefined),
}))

mock.module('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ auth: { setUser: mock(() => undefined) } }),
  },
}))

mock.module('@/features/auth/lib/storage', () => ({
  consumePendingPostLoginRedirect: mock(() => undefined),
}))

mock.module('@/features/onboarding/api', () => ({
  getCardStatus: mock(async () => ({ success: true, data: {} })),
}))

mock.module('@/features/subscriptions/components/dialogs/subscription-purchase-dialog', () => ({
  RecallClaimProvider: (props: { children: React.ReactNode }) => (
    <>{props.children}</>
  ),
}))

mock.module('sonner', () => ({
  toast: {
    dismiss: mock(() => undefined),
    error: mock(() => undefined),
    info: mock(() => undefined),
    loading: mock(() => 'toast-id'),
    success: mock(() => undefined),
  },
}))

mock.module('./api', () => ({
  getPaddleTopUpStatus: mock(async () => ({ success: false })),
  isApiSuccess: (response: { success?: boolean }) => response.success === true,
  resumeStripeTopup: mock(async () => ({ success: false })),
}))

mock.module('./wallet-recall-offers', () => ({
  refreshWalletRecallOffers: mock(
    async (params: {
      setLoading: (loading: boolean) => void
      setOffers: (offers: []) => void
    }) => {
      params.setLoading(false)
      params.setOffers([])
    }
  ),
  validateWalletRecallClaimAndRefresh: mock(async () => undefined),
}))

mock.module('./hooks', () => ({
  usePayment: () => ({
    checkoutDialog: null,
    closeCheckoutDialog: mock(() => undefined),
    openStripeCheckout: mock(() => undefined),
    openStripeCheckoutResponse: mock(() => false),
    processPayment: mock(async () => false),
    processing: false,
  }),
  useTopupInfo: () => ({
    loading: false,
    presetAmounts: [{ value: 20 }],
    topupInfo: {
      enable_online_topup: false,
      enable_stripe_topup: true,
      pay_methods: [{ name: 'Stripe', type: 'stripe', min_topup: 1 }],
      min_topup: 1,
      stripe_min_topup: 1,
      amount_options: [20],
      stripe_currency_prices: { USD: { 20: 2000 } },
      discount: {},
      bonus: {},
      enable_redemption: false,
      client_region: 'BR',
    } satisfies TopupInfo,
  }),
}))

mock.module('./components/subscription-plans-card', () => ({
  SubscriptionPlansCard: () => null,
}))

mock.module('./components/dialogs/billing-history-dialog', () => ({
  BillingHistoryPanel: () => null,
}))

mock.module('./components/dialogs/stripe-checkout-dialog', () => ({
  StripeCheckoutDialog: () => null,
}))

mock.module('@/components/layout', () => ({
  SectionPageLayout: Object.assign(
    (props: { children: React.ReactNode }) => <div>{props.children}</div>,
    {
      Content: (props: { children: React.ReactNode }) => (
        <div>{props.children}</div>
      ),
      Title: (props: { children: React.ReactNode }) => (
        <div>{props.children}</div>
      ),
    }
  ),
}))

mock.module('@/components/ui/alert', () => ({
  Alert: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  AlertDescription: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  AlertTitle: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

mock.module('@/components/ui/button', () => ({
  Button: (props: { children?: React.ReactNode; onClick?: () => void }) => (
    <button onClick={props.onClick}>{props.children}</button>
  ),
}))

mock.module('@/components/ui/dialog', () => ({
  Dialog: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  DialogContent: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  DialogFooter: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  DialogHeader: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  DialogTitle: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

mock.module('@/components/ui/titled-card', () => ({
  TitledCard: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

mock.module('lucide-react', () => ({
  CreditCard: () => null,
  Landmark: () => null,
  Loader2: () => null,
  PartyPopper: () => null,
  Wallet2: () => null,
}))

mock.module('./lib/paddle-checkout', () => ({
  openPaddleCheckoutForTransaction: mock(async () => undefined),
}))

const { Wallet } = await import('./index')
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'pt-BR',
    fallbackLng: 'en',
    resources: { en: { translation: {} }, 'pt-BR': { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  window.location.href = 'http://localhost/wallet?currency=BRL'
  window.location.pathname = '/wallet'
  window.location.search = '?currency=BRL'
  window.location.hash = ''
})

afterAll(() => {
  restoreTestGlobals()
})

function renderWallet(initialCheckoutSearch?: WalletCheckoutSearch): {
  container: HTMLElement
  root: Root
} {
  const container = document.createElement('div')
  const root = createRoot(container)

  React.act(() => {
    root.render(
      <I18nextProvider i18n={testI18n}>
        <Wallet initialCheckoutSearch={initialCheckoutSearch} />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function flushReactWork() {
  await React.act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function dispose(root: Root) {
  React.act(() => {
    root.unmount()
  })
}

describe('Wallet checkout currency integration', () => {
  test('falls back from an inbound checkout currency with no configured prices', async () => {
    const { container, root } = renderWallet({ currency: 'BRL' })

    try {
      await flushReactWork()

      expect(container.textContent).toContain('$20')
      expect(container.textContent).not.toContain(
        'No top-up packages available'
      )
    } finally {
      dispose(root)
    }
  })
})
