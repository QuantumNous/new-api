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
import { afterEach, describe, expect, mock, test } from 'bun:test'

const assign = mock(() => undefined)

mock.module('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => effect(),
  useRef: () => ({ current: {} }),
  useState: <T,>(initialState: T) => [initialState, () => undefined],
}))

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

mock.module('sonner', () => ({
  toast: {
    error: mock(() => undefined),
    success: mock(() => undefined),
  },
}))

mock.module('lucide-react', () => ({
  Gift: () => null,
  Loader2: () => null,
}))

mock.module('@/components/dialog', () => ({
  Dialog: ({ children }: { children: unknown }) => children,
}))

mock.module('@stripe/stripe-js', () => ({
  loadStripe: async () => ({
    createEmbeddedCheckoutPage: async () => ({
      mount: () => {
        throw new Error('mount failed')
      },
      destroy: () => undefined,
    }),
  }),
}))

afterEach(() => {
  assign.mockClear()
})

describe('StripeEmbeddedCheckoutDialog', () => {
  test('opens the fallback URL when embedded checkout mount fails', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          assign,
        },
      },
    })
    const { StripeEmbeddedCheckoutDialog } = await import(
      './stripe-embedded-checkout-dialog'
    )
    const fallbackUrl = 'https://checkout.example.com/session'
    const dialogElement = StripeEmbeddedCheckoutDialog({
      session: {
        clientSecret: 'cs_test',
        publishableKey: 'pk_test',
        summary: null,
        fallbackUrl,
      },
      onOpenChange: () => undefined,
    })
    const frameElement = dialogElement.type(dialogElement.props)

    frameElement.type(frameElement.props)
    await Promise.resolve()
    await Promise.resolve()

    expect(assign).toHaveBeenCalledWith(fallbackUrl)
  })
})
