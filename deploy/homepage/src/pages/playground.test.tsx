import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Playground } from './playground'
import { I18nProvider } from '../i18n'
import * as apiModule from '../lib/api'
import * as authModule from '../lib/auth'

// Mock modules
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
  getAuthHeaders: vi.fn(() => ({})),
}))

vi.mock('../lib/auth', () => ({
  useAuth: vi.fn(),
}))

const mockApiGet = apiModule.api.get as any
const mockUseAuth = authModule.useAuth as any

describe('Playground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test' },
    } as any)

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders playground title', async () => {
    mockApiGet.mockResolvedValue([])

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Playground')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    expect(document.querySelector('.spinner')).toBeInTheDocument()
  })

  it('loads models on mount', async () => {
    const models = [
      { id: 'gpt-4', object: 'model' },
      { id: 'claude-3', object: 'model' },
    ]
    mockApiGet.mockResolvedValue(models)

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument()
    })
  })

  it('renders empty state when no messages', async () => {
    mockApiGet.mockResolvedValue([{ id: 'gpt-4' }])

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Type a message...')).toBeInTheDocument()
    })
  })

  it('renders model select dropdown', async () => {
    mockApiGet.mockResolvedValue([{ id: 'gpt-4' }])

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  it('renders send button', async () => {
    mockApiGet.mockResolvedValue([{ id: 'gpt-4' }])

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Send')).toBeInTheDocument()
    })
  })

  it('handles empty model list', async () => {
    mockApiGet.mockResolvedValue([])

    render(
      <MemoryRouter>
        <I18nProvider>
          <Playground />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.queryByRole('combobox')).toBeInTheDocument()
    })
  })
})
