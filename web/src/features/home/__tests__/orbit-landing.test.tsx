import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ORBIT_MODELS } from '@/lib/orbit-models'

import { OrbitLanding, OrbitModelHub } from '../components/orbit-landing'

const status = vi.hoisted(() => ({ register_enabled: true }))
vi.mock('@/hooks/use-status', () => ({ useStatus: () => ({ status }) }))
vi.mock('lenis', () => ({
  default: class {
    destroy() {}
  },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props} />
  ),
}))
afterEach(() => {
  status.register_enabled = true
})

test('shows approved branding, planned endpoint, policy, and real upstream attribution', () => {
  render(<OrbitLanding isAuthenticated={false} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Built for Developers.Powered by AI.'
  )
  expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
    'href',
    '/sign-up'
  )
  expect(screen.getByText('Planned endpoint · Not deployed')).toBeVisible()
  expect(screen.getByText(/10 requests per minute/)).toHaveTextContent(
    '1 million chargeable tokens per four-hour window'
  )
  expect(screen.getByText(/15 requests per minute/)).toHaveTextContent(
    'fair use and provider availability'
  )
  expect(
    screen.getByRole('link', {
      name: 'Frontend design and development by New API contributors.',
    })
  ).toHaveAttribute('href', 'https://github.com/QuantumNous/new-api')
})
test('respects closed registration and routes the primary action to sign-in', () => {
  status.register_enabled = false
  render(<OrbitLanding isAuthenticated={false} />)
  expect(screen.getAllByRole('link', { name: 'Sign In' })[0]).toHaveAttribute(
    'href',
    '/sign-in'
  )
  expect(
    screen.queryByRole('link', { name: 'Get Started' })
  ).not.toBeInTheDocument()
})
test('takes an authenticated developer to the existing dashboard', () => {
  render(<OrbitLanding isAuthenticated />)
  expect(screen.getByRole('link', { name: 'Open Dashboard' })).toHaveAttribute(
    'href',
    '/dashboard'
  )
})
test('shows exactly the approved eight planned models and preserves the configured catalog route', () => {
  render(<OrbitModelHub />)
  expect(screen.getAllByRole('article')).toHaveLength(8)
  for (const model of ORBIT_MODELS) {
    expect(screen.getByText(model.id)).toBeVisible()
  }
  expect(screen.getAllByText('Planned')).toHaveLength(8)
  expect(
    screen.getAllByRole('link', { name: 'Configured gateway models' })[0]
  ).toHaveAttribute('href', '/pricing')
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'orbit-vision' },
  })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(
    within(screen.getByRole('article')).getByRole('heading')
  ).toHaveTextContent('Orbit Vision')
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'does-not-exist' },
  })
  expect(screen.getByRole('status')).toHaveTextContent(
    'No planned models match your search.'
  )
})
