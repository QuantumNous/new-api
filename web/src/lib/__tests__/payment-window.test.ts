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
import { toast } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'

import { openPaymentWindow } from '../payment-window'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

test('opens a sized popup and detaches its opener before navigating without leaving the wallet', () => {
  const original = window.location.href
  const popup = {
    opener: window as Window | null,
    location: { replace: vi.fn(() => expect(popup.opener).toBeNull()) },
    focus: vi.fn(),
    close: vi.fn(),
  }
  const open = vi
    .spyOn(window, 'open')
    .mockReturnValue(popup as unknown as Window)
  expect(openPaymentWindow('https://mixpay.me/code/original')).toBe(true)
  expect(open).toHaveBeenCalledWith(
    '',
    '_blank',
    expect.stringContaining('popup=yes,width=')
  )
  expect(popup.location.replace).toHaveBeenCalledWith(
    'https://mixpay.me/code/original'
  )
  expect(window.location.href).toBe(original)
})

test('blocked popup retains the original checkout for a user-initiated retry', () => {
  const popup = {
    opener: null,
    location: { replace: vi.fn() },
    focus: vi.fn(),
    close: vi.fn(),
  }
  const open = vi
    .spyOn(window, 'open')
    .mockReturnValueOnce(null)
    .mockReturnValue(popup as unknown as Window)
  expect(openPaymentWindow('https://checkout.example/pay')).toBe(false)
  const options = vi.mocked(toast.error).mock.calls[0][1]
  const action = options?.action as unknown as { onClick: () => void }
  action.onClick()
  expect(open).toHaveBeenCalledTimes(2)
  expect(popup.location.replace).toHaveBeenCalledWith(
    'https://checkout.example/pay'
  )
})

test('POST gateways submit their original fields inside the popup', () => {
  const doc = document.implementation.createHTMLDocument('Payment')
  const popup = {
    opener: window,
    document: doc,
    focus: vi.fn(),
    close: vi.fn(),
  }
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  const submit = vi
    .spyOn(HTMLFormElement.prototype, 'submit')
    .mockImplementation(() => {})
  openPaymentWindow('https://checkout.example/submit', {
    order: 'original',
    amount: '1.43',
  })
  const form = doc.querySelector('form')
  if (!form) throw new Error('Missing payment form')
  expect(form.method).toBe('post')
  expect(form.action).toBe('https://checkout.example/submit')
  expect(form.querySelector<HTMLInputElement>('[name="order"]')?.value).toBe(
    'original'
  )
  expect(submit).toHaveBeenCalledOnce()
  expect(document.querySelector('form')).toBeNull()
})

test.each([
  'javascript:alert(1)',
  'data:text/html,unsafe',
  '/checkout',
  'https://user:password@example.com',
])('rejects unsafe checkout %s before opening a window', (url) => {
  const open = vi.spyOn(window, 'open')
  expect(openPaymentWindow(url)).toBe(false)
  expect(open).not.toHaveBeenCalled()
})

test.each([
  { availableWidth: 1920, availableHeight: 1080, width: 1080, height: 720 },
  { availableWidth: 390, availableHeight: 640, width: 390, height: 640 },
])(
  'payment popup uses desktop landscape dimensions bounded by the screen: %j',
  (size) => {
    vi.spyOn(window.screen, 'availWidth', 'get').mockReturnValue(
      size.availableWidth
    )
    vi.spyOn(window.screen, 'availHeight', 'get').mockReturnValue(
      size.availableHeight
    )
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openPaymentWindow('https://mixpay.me/code/original')
    expect(open).toHaveBeenCalledWith(
      '',
      '_blank',
      expect.stringContaining(
        `popup=yes,width=${size.width},height=${size.height},`
      )
    )
  }
)

test('reserves the popup before resolving the hosted URL and navigates directly', async () => {
  const popup = {
    opener: window,
    closed: false,
    document: document.implementation.createHTMLDocument('Payment'),
    location: { replace: vi.fn() },
    focus: vi.fn(),
    close: vi.fn(),
  }
  const open = vi
    .spyOn(window, 'open')
    .mockReturnValue(popup as unknown as Window)
  let resolveURL!: (url: string) => void
  const getURL = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        resolveURL = resolve
      })
  )
  expect(openPaymentWindow(getURL)).toBe(true)
  expect(open).toHaveBeenCalledOnce()
  expect(popup.opener).toBeNull()
  expect(popup.location.replace).not.toHaveBeenCalled()
  resolveURL('https://checkout.antom.com/pay')
  await vi.waitFor(() =>
    expect(popup.location.replace).toHaveBeenCalledWith(
      'https://checkout.antom.com/pay'
    )
  )
  expect(popup.location.replace).toHaveBeenCalledTimes(1)
})

test('blocked async payment popup does not create a session until the user retries', async () => {
  const getURL = vi.fn().mockResolvedValue('https://checkout.antom.com/pay')
  vi.spyOn(window, 'open').mockReturnValue(null)
  expect(openPaymentWindow(getURL)).toBe(false)
  expect(getURL).not.toHaveBeenCalled()
})
