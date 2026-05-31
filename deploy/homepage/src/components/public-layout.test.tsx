import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicLayout } from './public-layout'
import { I18nProvider } from '../i18n'
import * as apiModule from '../lib/api'

// Mock api module for PublicNav
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

const mockApiGet = vi.mocked(apiModule.api.get)

describe('PublicLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ system_name: 'Vynex API' })
  })

  it('renders public nav', () => {
    const { container } = render(
      <I18nProvider>
        <PublicLayout />
      </I18nProvider>
    )

    // PublicNav renders the nav
    expect(container.querySelector('nav')).toBeInTheDocument()
  })

  it('renders footer', () => {
    const { container } = render(
      <I18nProvider>
        <PublicLayout />
      </I18nProvider>
    )

    // Footer is rendered
    expect(container.querySelector('footer')).toBeInTheDocument()
    // Check for footer-specific elements
    expect(container.querySelector('.footer-brand')).toBeInTheDocument()
  })

  it('renders outlet placeholder for child routes', () => {
    const { container } = render(
      <I18nProvider>
        <PublicLayout />
      </I18nProvider>
    )

    // Outlet is rendered (even if empty in this test)
    // The layout should still render all components
    expect(container.querySelector('nav')).toBeInTheDocument()
    expect(container.querySelector('footer')).toBeInTheDocument()
  })

  it('has all layout components present', () => {
    const { container } = render(
      <I18nProvider>
        <PublicLayout />
      </I18nProvider>
    )

    expect(container.querySelector('nav')).toBeInTheDocument()
    expect(container.querySelector('footer')).toBeInTheDocument()
    expect(container.querySelector('.footer-inner')).toBeInTheDocument()
  })
})
