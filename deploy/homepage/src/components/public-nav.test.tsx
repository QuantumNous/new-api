import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublicNav } from './public-nav'
import { I18nProvider } from '../i18n'
import * as apiModule from '../lib/api'

// Mock api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

const mockApiGet = vi.mocked(apiModule.api.get)

describe('PublicNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders brand name', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(screen.getByText('Vynex API')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(screen.getByText('Models')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Console')).toBeInTheDocument()
  })

  it('renders language toggle button', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    const langButtons = screen.getAllByTitle('Switch language')
    expect(langButtons.length).toBeGreaterThan(0)
    expect(langButtons[0]).toHaveTextContent('中')
  })

  it('has correct href attributes for nav links', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(screen.getByText('Models').closest('a')).toHaveAttribute('href', '/#models')
    expect(screen.getByText('Docs').closest('a')).toHaveAttribute('href', '/docs/')
    expect(screen.getByText('Pricing').closest('a')).toHaveAttribute('href', '/pricing')
    expect(screen.getByText('Console').closest('a')).toHaveAttribute('href', '/sign-in')
  })

  it('fetches system name on mount', async () => {
    mockApiGet.mockResolvedValue({ system_name: 'Custom API Name' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(mockApiGet).toHaveBeenCalledWith('/api/status')

    await waitFor(() => {
      expect(screen.getByText('Custom API Name')).toBeInTheDocument()
    })
  })

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('API Error'))

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    // Should still render with default name
    expect(screen.getByText('Vynex API')).toBeInTheDocument()
  })

  it('toggles mobile menu', async () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    const toggleButton = screen.getByLabelText('Menu')
    expect(screen.queryByText('Models')).toBeInTheDocument()

    // Mobile menu is closed initially
    expect(document.querySelector('.mobile-menu')).not.toBeInTheDocument()

    // Click toggle to open
    await userEvent.click(toggleButton)

    // Wait for mobile menu to appear
    expect(document.querySelector('.mobile-menu')).toBeInTheDocument()
  })

  it('closes mobile menu when clicking a link', async () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    const toggleButton = screen.getByLabelText('Menu')

    // Open mobile menu
    await userEvent.click(toggleButton)
    expect(document.querySelector('.mobile-menu')).toBeInTheDocument()

    // Click a link in mobile menu
    const modelsLink = screen.getAllByText('Models')[1] // Second one is in mobile menu
    await userEvent.click(modelsLink)

    // Menu should close
    expect(document.querySelector('.mobile-menu')).not.toBeInTheDocument()
  })

  it('has nav class name', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    const { container } = render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(container.querySelector('nav')).toHaveClass('nav')
  })

  it('has brand link pointing to home', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    const brandLink = screen.getByText('Vynex API').closest('a')
    expect(brandLink).toHaveAttribute('href', '/')
  })

  it('has nav-links container', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    const { container } = render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(container.querySelector('.nav-links')).toBeInTheDocument()
  })

  it('has mobile-actions container', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    const { container } = render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    expect(container.querySelector('.mobile-actions')).toBeInTheDocument()
  })

  it('has mobile-toggle button', () => {
    mockApiGet.mockResolvedValue({ system_name: 'Test API' })

    render(
      <I18nProvider>
        <PublicNav />
      </I18nProvider>
    )

    const toggleButton = screen.getByLabelText('Menu')
    expect(toggleButton).toHaveClass('mobile-toggle')
  })
})
