import { fireEvent, render, screen, act, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { GlobeIntro } from '../globe-intro'

const site = vi.hoisted(() => ({ home_business_qrcode: '' }))
vi.mock('@/hooks/use-status', () => ({ useStatus: () => ({ status: site }) }))

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
  site.home_business_qrcode = ''
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

test('empty business contacts hide the entry and dialog', () => {
  motion(true)
  render(<GlobeIntro />)
  expect(
    screen.queryByRole('button', { name: 'Business cooperation' })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('globe overlay prevents selection and lets dragging pass through except on actions', () => {
  motion(true)
  render(<GlobeIntro />)
  const logo = screen.getByRole('img', { name: 'HCAI' })
  expect(logo).toHaveAttribute('draggable', 'false')
  expect(logo.parentElement).not.toHaveClass('pointer-events-auto')
  expect(logo.parentElement?.parentElement).toHaveClass(
    'pointer-events-none',
    'select-none'
  )
  expect(
    screen.getByRole('link', { name: 'Try it now' }).parentElement
  ).toHaveClass('pointer-events-auto')
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

test('business cooperation displays every configured QR code with its label', async () => {
  motion(true)
  site.home_business_qrcode = JSON.stringify([
    { label: 'WeChat sales', image: 'https://example.com/wechat.png' },
    { label: 'Telegram', image: 'https://example.com/telegram.png' },
  ])
  const { rerender } = render(<GlobeIntro />)
  fireEvent.click(screen.getByRole('button', { name: 'Business cooperation' }))
  expect(await screen.findByRole('dialog')).toHaveClass(
    'dark',
    'bg-popover',
    'text-popover-foreground',
    'ring-foreground/10'
  )
  expect(
    await screen.findByRole('img', { name: 'WeChat sales' })
  ).toHaveAttribute('src', 'https://example.com/wechat.png')
  expect(screen.getByRole('img', { name: 'Telegram' })).toHaveAttribute(
    'src',
    'https://example.com/telegram.png'
  )
  expect(screen.getByText('WeChat sales')).toBeVisible()
  expect(screen.getByText('Telegram')).toBeVisible()
  site.home_business_qrcode = '[]'
  rerender(<GlobeIntro />)
  expect(
    screen.queryByRole('button', { name: 'Business cooperation' })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
