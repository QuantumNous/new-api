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

const originalStorageDescriptors = {
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
}

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
  restoreGlobalPropertyDescriptors(originalGlobalPropertyDescriptors)
}

function restoreGlobalPropertyDescriptors(
  descriptors: ReadonlyMap<PropertyKey, PropertyDescriptor | undefined>
) {
  for (const [key, descriptor] of descriptors) {
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
  const storage = {
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem: () => undefined,
    setItem: () => undefined,
  } as Storage
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
  defineTestGlobal('localStorage', storage)
  defineTestGlobal('sessionStorage', storage)
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
  defineTestGlobal('Element', ElementShim as unknown as typeof Element)
  defineTestGlobal('HTMLElement', ElementShim as unknown as typeof HTMLElement)
  defineTestGlobal(
    'HTMLButtonElement',
    ElementShim as unknown as typeof HTMLButtonElement
  )
  defineTestGlobal(
    'HTMLDivElement',
    ElementShim as unknown as typeof HTMLDivElement
  )
  defineTestGlobal('HTMLIFrameElement', class {} as typeof HTMLIFrameElement)
  defineTestGlobal(
    'HTMLInputElement',
    ElementShim as unknown as typeof HTMLInputElement
  )
  defineTestGlobal(
    'HTMLSpanElement',
    ElementShim as unknown as typeof HTMLSpanElement
  )
  defineTestGlobal('Node', NodeShim as unknown as typeof Node)
  defineTestGlobal('IS_REACT_ACT_ENVIRONMENT', true)
}

setupDom()

mock.module('@/lib/api', () => ({
  api: {
    delete: mock(async () => ({ data: { success: true } })),
    get: mock(async () => ({ data: { success: true, data: null } })),
    post: mock(async () => ({ data: { success: true, data: null } })),
    put: mock(async () => ({ data: { success: true, data: null } })),
  },
  disable2FA: mock(async () => ({ success: true })),
  enable2FA: mock(async () => ({ success: true })),
  get2FAStatus: mock(async () => ({ success: true })),
  getCommonHeaders: () => ({ 'Content-Type': 'application/json' }),
  getNotice: mock(async () => ({ success: true })),
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
  getStatus: mock(async () => ({ success: true })),
  getUserGroups: mock(async () => ({ success: true, data: [] })),
  getUserModels: mock(async () => ({ success: true, data: [] })),
  regenerate2FABackupCodes: mock(async () => ({ success: true })),
  setup2FA: mock(async () => ({ success: true })),
}))

mock.module('@/lib/analytics/gtag', () => ({
  ensureGtagLoaded: mock(async () => undefined),
  getGAMeasurementIdentifiers: () => ({}),
  isGtagEnabled: () => false,
  shouldInitializeGtagForURL: () => false,
  trackAdsFunnelEvent: mock(() => undefined),
  trackSignupConversion: mock(() => undefined),
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
  isApiSuccess: (response: { success?: boolean }) => response.success === true,
  requestPromoTopup: mock(async () => ({ success: true })),
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
  calculateAmount: mock(async () => ({ success: true })),
  calculatePaddleAmount: mock(async () => ({ success: true })),
  calculateStripeAmount: mock(async () => ({ success: true })),
  calculateWaffoPancakeAmount: mock(async () => ({ success: true })),
  completeOrder: mock(async () => ({ success: true })),
  getAllBillingHistory: mock(async () => ({ success: true, data: [] })),
  getInvoiceProfile: mock(async () => ({ success: true, data: null })),
  getPaddleTopUpStatus: mock(async () => ({ success: false })),
  getRefundableSubscriptionTerms: mock(async () => ({
    success: true,
    data: { items: [], total_refund_money: 0, total_refund_quota: 0 },
  })),
  getTopupInfo: mock(async () => ({ success: true, data: null })),
  getUserBillingHistory: mock(async () => ({
    success: true,
    data: { items: [], total: 0 },
  })),
  isApiSuccess: (response: { success?: boolean }) => response.success === true,
  refundSubscriptionTerm: mock(async () => ({ success: true })),
  requestCreemPayment: mock(async () => ({ success: true })),
  requestPaddlePayment: mock(async () => ({ success: true })),
  requestPayment: mock(async () => ({ success: true })),
  requestStripePayment: mock(async () => ({ success: true })),
  requestTopupInvoice: mock(async () => ({ success: true, data: null })),
  requestWaffoPancakePayment: mock(async () => ({ success: true })),
  requestWaffoPayment: mock(async () => ({ success: true })),
  resumeStripeTopup: mock(async () => ({ success: false })),
  updateInvoiceProfile: mock(async () => ({ success: true, data: null })),
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

mock.module('./lib', async () => {
  const stripeCurrency = await import('./lib/stripe-currency')
  const payment = await import('./lib/payment')

  return {
    ...stripeCurrency,
    ...payment,
    clearPaddleCheckoutUrlFallback: () => undefined,
    getInitialPresetTopupAmount: () => 20,
    getMinTopupAmount: () => 1,
    getPaddleCheckoutUrlFallback: () => undefined,
    isPresetTopupAmount: (amount: number) => amount === 20,
    shouldConsumeWalletCheckoutSearchParams: () => false,
  }
})

mock.module('./components/dialogs/billing-history-dialog', () => ({
  BillingHistoryPanel: () => null,
}))

mock.module('./components/dialogs/stripe-checkout-dialog', () => ({
  StripeCheckoutDialog: () => null,
}))

mock.module('@/components/ui/dialog', () => {
  const Part = (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  )

  return {
    Dialog: Part,
    DialogClose: Part,
    DialogContent: Part,
    DialogDescription: Part,
    DialogFooter: Part,
    DialogHeader: Part,
    DialogOverlay: Part,
    DialogPortal: Part,
    DialogTitle: Part,
    DialogTrigger: Part,
  }
})

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
  test('registers storage globals with their pre-shim descriptors for afterAll restoration', () => {
    expect(originalGlobalPropertyDescriptors.has('localStorage')).toBe(true)
    expect(originalGlobalPropertyDescriptors.has('sessionStorage')).toBe(true)
    expect(originalGlobalPropertyDescriptors.get('localStorage')).toEqual(
      originalStorageDescriptors.localStorage
    )
    expect(originalGlobalPropertyDescriptors.get('sessionStorage')).toEqual(
      originalStorageDescriptors.sessionStorage
    )
  })

  test('restores or deletes storage globals from their saved descriptors', () => {
    const shimmedLocalStorage = globalThis.localStorage
    const shimmedSessionStorage = globalThis.sessionStorage

    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: shimmedLocalStorage,
        writable: true,
      })
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: shimmedSessionStorage,
        writable: true,
      })

      restoreGlobalPropertyDescriptors(
        new Map<PropertyKey, PropertyDescriptor | undefined>([
          ['localStorage', originalStorageDescriptors.localStorage],
          ['sessionStorage', originalStorageDescriptors.sessionStorage],
        ])
      )

      if (originalStorageDescriptors.localStorage) {
        expect(
          Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
        ).toEqual(originalStorageDescriptors.localStorage)
      } else {
        expect(Object.hasOwn(globalThis, 'localStorage')).toBe(false)
      }

      if (originalStorageDescriptors.sessionStorage) {
        expect(
          Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
        ).toEqual(originalStorageDescriptors.sessionStorage)
      } else {
        expect(Object.hasOwn(globalThis, 'sessionStorage')).toBe(false)
      }
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: shimmedLocalStorage,
        writable: true,
      })
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: shimmedSessionStorage,
        writable: true,
      })
    }
  })

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
