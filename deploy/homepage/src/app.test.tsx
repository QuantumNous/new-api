import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './app'
import { I18nProvider } from './i18n'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all main sections', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { system_name: 'Test API' } })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('nav')).toBeInTheDocument()
    expect(container.querySelector('.hero')).toBeInTheDocument()
    expect(container.querySelector('.metrics')).toBeInTheDocument()
    expect(container.querySelector('.model-grid')).toBeInTheDocument()
    expect(container.querySelector('.workflow-grid')).toBeInTheDocument()
    expect(container.querySelector('.dev-grid')).toBeInTheDocument()
    expect(container.querySelector('.final-cta')).toBeInTheDocument()
    expect(container.querySelector('footer')).toBeInTheDocument()
  })

  it('fetches system name on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { system_name: 'Custom API' } })
    })

    render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(mockFetch).toHaveBeenCalledWith('/api/status')
  })

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    // Should still render with default name
    expect(container.querySelector('nav')).toBeInTheDocument()
  })

  it('renders hero section', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(screen.getByText('One API,')).toBeInTheDocument()
    expect(screen.getByText('all frontier models.')).toBeInTheDocument()
  })

  it('renders metrics', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(screen.getByText('34+')).toBeInTheDocument()
    expect(screen.getByText('/v1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders model cards', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(screen.getByText('GPT')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('Gemini')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('renders workflow steps', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('.workflow-grid')).toBeInTheDocument()
    expect(container.querySelectorAll('.step').length).toBe(3)
  })

  it('renders dev links', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('.dev-grid')).toBeInTheDocument()
    expect(container.querySelectorAll('.dev-card').length).toBe(3)
  })

  it('renders CTA section', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('.final-cta')).toBeInTheDocument()
    expect(screen.getByText('Launch AI features without integrating every upstream provider.')).toBeInTheDocument()
  })

  it('renders footer', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('footer')).toBeInTheDocument()
    expect(container.querySelector('.footer-brand')).toBeInTheDocument()
  })

  it('renders mobile menu toggle', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('.mobile-toggle')).toBeInTheDocument()
  })

  it('renders mobile actions', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    expect(container.querySelector('.mobile-actions')).toBeInTheDocument()
  })

  it('opens mobile menu when toggle is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} })
    })

    const { container } = render(
      <I18nProvider>
        <App />
      </I18nProvider>
    )

    const toggleButton = screen.getByLabelText('Menu')
    await userEvent.click(toggleButton)

    expect(container.querySelector('.mobile-menu')).toBeInTheDocument()
  })
})
