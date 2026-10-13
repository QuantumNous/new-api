import { fireEvent, render, screen, act, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { GlobeIntro } from '../globe-intro'

const auth = vi.hoisted(() => ({ user: null as object | null }))
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { auth: typeof auth }) => unknown) =>
    selector({ auth }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  auth.user = null
})

function motion(reduced: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

test('guest enters sign in and an authenticated user enters the console', () => {
  motion(true)
  const { rerender } = render(<GlobeIntro />)
  expect(screen.getByRole('link', { name: 'Try it now' })).toHaveAttribute(
    'href',
    '/sign-in'
  )
  auth.user = { id: 1 }
  rerender(<GlobeIntro />)
  expect(screen.getByRole('link', { name: 'Try it now' })).toHaveAttribute(
    'href',
    '/dashboard'
  )
})

test('business cooperation opens the supplied QR code dialog', async () => {
  motion(true)
  render(<GlobeIntro />)
  fireEvent.click(screen.getByRole('button', { name: 'Business cooperation' }))
  expect(await screen.findByRole('dialog')).toBeVisible()
  expect(
    screen.getByRole('img', { name: 'Business WeChat QR code' })
  ).toHaveAttribute('src', '/home-globe/business-wechat.png')
})

test('typing rotates slogans and clears its timer on unmount', () => {
  motion(false)
  vi.useFakeTimers()
  const { unmount } = render(<GlobeIntro />)
  act(() => vi.advanceTimersByTime(3000))
  expect(
    screen.getByText('One gateway. Every possibility.', { exact: false })
  ).toBeVisible()
  act(() => vi.advanceTimersByTime(5000))
  expect(screen.getByText('Switch models.', { exact: false })).toBeVisible()
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
