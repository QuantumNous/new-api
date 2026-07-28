/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { api } from '@/lib/api'
import type { TopupInfo } from './types'

type Effect = () => void | (() => void)

const effects: Effect[] = []
const processPayment = mock(async () => false)
const closeEmbeddedCheckout = mock(() => undefined)
const openStripeCheckout = mock(() => null)
const openStripeCheckoutResponse = mock(() => null)

const topupInfo: TopupInfo = {
  enable_online_topup: false,
  enable_stripe_topup: true,
  pay_methods: [],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [10],
  stripe_price_ids: { 10: 'price_topup_10' },
  discount: {},
  bonus: {},
}

mock.module('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: Effect) => {
    effects.push(effect)
  },
  useRef: (value: unknown) => ({ current: value }),
  useState: (initialValue: unknown) => [
    typeof initialValue === 'function'
      ? (initialValue as () => unknown)()
      : initialValue,
    mock(() => undefined),
  ],
}))

const jsx = (type: unknown, props: unknown, key?: unknown) => ({
  key,
  props,
  type,
})

mock.module('react/jsx-dev-runtime', () => ({
  Fragment: Symbol.for('react.fragment'),
  jsxDEV: jsx,
}))

mock.module('react/jsx-runtime', () => ({
  Fragment: Symbol.for('react.fragment'),
  jsx,
  jsxs: jsx,
}))

mock.module('lucide-react', () => ({
  PartyPopper: () => null,
  Wallet2: () => null,
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

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

mock.module('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      auth: { setUser: mock(() => undefined) },
    }),
  },
}))

mock.module('@/features/auth/lib/storage', () => ({
  consumePendingPostLoginRedirect: mock(() => undefined),
}))

mock.module('@/components/layout', () => ({
  SectionPageLayout: Object.assign(
    (props: { children?: unknown }) => props.children,
    {
      Title: (props: { children?: unknown }) => props.children,
      Content: (props: { children?: unknown }) => props.children,
    }
  ),
}))

mock.module('@/components/ui/alert', () => ({
  Alert: (props: { children?: unknown }) => props.children,
  AlertDescription: (props: { children?: unknown }) => props.children,
  AlertTitle: (props: { children?: unknown }) => props.children,
}))

mock.module('@/components/ui/button', () => ({
  Button: (props: { children?: unknown }) => props.children,
}))

mock.module('@/components/ui/dialog', () => ({
  Dialog: (props: { children?: unknown }) => props.children,
  DialogContent: (props: { children?: unknown }) => props.children,
  DialogDescription: (props: { children?: unknown }) => props.children,
  DialogFooter: (props: { children?: unknown }) => props.children,
  DialogHeader: (props: { children?: unknown }) => props.children,
  DialogTitle: (props: { children?: unknown }) => props.children,
}))

mock.module('@/components/ui/separator', () => ({
  Separator: () => null,
}))

mock.module('@/components/ui/titled-card', () => ({
  TitledCard: (props: { children?: unknown }) => props.children,
}))

mock.module(
  '@/features/subscriptions/components/dialogs/subscription-purchase-dialog',
  () => ({
    RecallClaimProvider: (props: { children?: unknown }) => props.children,
  })
)

mock.module('./hooks', () => ({
  useTopupInfo: () => ({
    topupInfo,
    presetAmounts: [{ value: 10 }],
    loading: false,
  }),
  usePayment: () => ({
    processing: false,
    processPayment,
    embeddedCheckout: null,
    closeEmbeddedCheckout,
    openStripeCheckout,
    openStripeCheckoutResponse,
  }),
}))

mock.module('./lib', () => ({
  clearPaddleCheckoutUrlFallback: mock(() => undefined),
  defaultCurrencyForRegion: () => 'USD',
  getInitialPresetTopupAmount: () => 10,
  getMinTopupAmount: () => 1,
  getPaddleCheckoutUrlFallback: () => null,
  getWalletCheckoutInitialTopupAmount: () => 0,
  isPresetTopupAmount: () => true,
  normalizeStripeCheckoutCurrency: (currency?: string) =>
    currency === 'BRL' || currency === 'INR' || currency === 'JPY'
      ? currency
      : currency === 'USD'
        ? 'USD'
        : null,
  shouldConsumeWalletCheckoutSearchParams: () => false,
  shouldShowCurrencySelector: () => false,
}))

mock.module('./components/subscription-plans-card', () => ({
  SubscriptionPlansCard: () => null,
}))

mock.module('./components/recharge-form-card', () => ({
  RechargeFormCard: () => null,
}))

mock.module('./components/dialogs/billing-history-dialog', () => ({
  BillingHistoryPanel: () => null,
}))

mock.module('./components/dialogs/stripe-embedded-checkout-dialog', () => ({
  StripeEmbeddedCheckoutDialog: () => null,
}))

mock.module('@/features/onboarding/api', () => ({
  getCardStatus: mock(async () => ({
    success: true,
    data: { card_bound: false },
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

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function installWindow(href: string) {
  const updateLocation = (nextHref: string) => {
    const url = new URL(nextHref, 'https://flatkey.test')
    window.location.href = url.href
    window.location.pathname = url.pathname
    window.location.search = url.search
    window.location.hash = url.hash
  }

  globalThis.window = {
    history: {
      state: {},
      replaceState: (_state: unknown, _title: string, url?: string | URL) => {
        if (url != null) {
          updateLocation(String(url))
        }
      },
    },
    location: {
      assign: mock(() => undefined),
      hash: '',
      href: '',
      pathname: '',
      search: '',
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    },
    clearTimeout: (_id: number) => undefined,
    setTimeout: (callback: () => void) => {
      callback()
      return 0
    },
  } as unknown as Window & typeof globalThis
  globalThis.document = {
    getElementById: mock(() => null),
  } as unknown as Document
  updateLocation(href)
}

async function runWalletEffects(props: { initialRecallClaim?: string } = {}) {
  effects.length = 0
  const { Wallet } = await import('./index')

  Wallet(props)
  for (const effect of [...effects]) {
    effect()
  }
  await flushAsyncWork()
}

describe('Wallet account recall offers', () => {
  beforeEach(() => {
    mock.restore()
    installWindow('https://flatkey.test/wallet')
  })

  test('fetches account recall offers on an authenticated wallet load without a recall claim', async () => {
    const get = spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/user/self') {
        return { data: { success: true, data: { id: 1, quota: 0 } } } as never
      }
      if (url === '/api/user/recall/offers') {
        return { data: { success: true, data: [] } } as never
      }
      return { data: { success: true, data: null } } as never
    })

    await runWalletEffects()

    expect(
      get.mock.calls.filter((call) => call[0] === '/api/user/recall/offers')
    ).toHaveLength(1)
  })

  test('refreshes account offers from finally after an invalid claim validation', async () => {
    installWindow('https://flatkey.test/wallet?recall_claim=stale-claim')
    const get = spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/user/self') {
        return { data: { success: true, data: { id: 1, quota: 0 } } } as never
      }
      if (url === '/api/user/recall/offers') {
        return { data: { success: true, data: [] } } as never
      }
      return { data: { success: true, data: null } } as never
    })
    const post = spyOn(api, 'post').mockResolvedValue({
      data: { success: false, message: 'invalid' },
    } as never)

    await runWalletEffects({ initialRecallClaim: 'stale-claim' })

    expect(post.mock.calls[0]?.[0]).toBe('/api/user/recall/claim/validate')
    expect(
      get.mock.calls.filter((call) => call[0] === '/api/user/recall/offers')
    ).toHaveLength(2)
    expect(window.location.search).not.toContain('recall_claim')
  })
})
