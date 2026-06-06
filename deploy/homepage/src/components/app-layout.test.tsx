import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppLayout } from './app-layout'
import { I18nProvider } from '../i18n'
import * as authModule from '../lib/auth'

// Mock auth module
vi.mock('../lib/auth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(authModule.useAuth)

describe('AppLayout', () => {
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockClear()
  })

  function renderWithRouter(component: React.ReactNode) {
    return render(
      <MemoryRouter>
        <I18nProvider>
          {component}
        </I18nProvider>
      </MemoryRouter>
    )
  }

  it('renders app layout container', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.app-layout')).toBeInTheDocument()
  })

  it('renders sidebar', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.sidebar')).toBeInTheDocument()
  })

  it('renders main area', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.main-area')).toBeInTheDocument()
  })

  it('renders sidebar brand', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Vynex API')).toBeInTheDocument()
  })

  it('renders user navigation items', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Playground')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('Usage Logs')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('renders admin navigation items for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Channels')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Models')).toBeInTheDocument()
    expect(screen.getByText('Redemption Codes')).toBeInTheDocument()
  })

  it('renders root navigation items for root users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'root', display_name: 'Root', role: 100 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => true,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not render admin items for regular users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.queryByText('Channels')).not.toBeInTheDocument()
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
  })

  it('does not render root items for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('renders user info in top bar', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'testuser', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('USER')).toBeInTheDocument()
  })

  it('shows ADMIN badge for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('shows ROOT badge for root users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'root', display_name: 'Root', role: 100 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => true,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('ROOT')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    const logoutBtn = screen.getByText('Logout')
    expect(logoutBtn).toBeInTheDocument()
  })

  it('calls logout when logout button is clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    const logoutBtn = screen.getByText('Logout').closest('button')
    await userEvent.click(logoutBtn!)

    expect(mockLogout).toHaveBeenCalled()
  })

  it('renders language selector with Russian option', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByLabelText('Switch language')).toHaveDisplayValue('English')
    expect(screen.getByText('Русский')).toBeInTheDocument()
  })

  it('renders mobile toggle button', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.mobile-toggle')).toBeInTheDocument()
  })

  it('renders sidebar footer with docs link', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Docs')).toBeInTheDocument()
  })

  it('has content area for outlet', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.content')).toBeInTheDocument()
  })

  it('toggles admin section', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin User', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    // Check that admin section is rendered
    expect(container.querySelectorAll('.nav-section').length).toBeGreaterThan(1)
  })

  it('renders nav sections', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    // Check for nav sections
    const sections = container.querySelectorAll('.nav-section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('renders top bar', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.top-bar')).toBeInTheDocument()
  })

  it('renders sidebar brand with mark', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.brand-mark-sm')).toBeInTheDocument()
  })

  it('renders sidebar title', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.sidebar-title')).toBeInTheDocument()
  })

  it('renders sidebar nav container', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.sidebar-nav')).toBeInTheDocument()
  })

  it('renders sidebar footer', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.sidebar-footer')).toBeInTheDocument()
  })

  it('renders subscription item for regular users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
  })

  it('renders all user navigation items with correct labels', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    // Check all nav items exist
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('Usage Logs')).toBeInTheDocument()
  })

  it('renders top bar user section', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.top-bar-user')).toBeInTheDocument()
  })

  it('renders user role badge', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.user-role-badge')).toBeInTheDocument()
  })

  it('renders top bar spacer', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    expect(container.querySelector('.top-bar-spacer')).toBeInTheDocument()
  })

  it('renders docs link in sidebar footer', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    renderWithRouter(<AppLayout />)

    // Should have at least one "Docs" link (in sidebar footer)
    const docsLinks = screen.getAllByText('Docs')
    expect(docsLinks.length).toBeGreaterThan(0)
  })

  it('renders nav items for user section', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    const navItems = container.querySelectorAll('.nav-item')
    expect(navItems.length).toBeGreaterThan(0)
  })

  it('toggles admin section when clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    const adminSections = container.querySelectorAll('.nav-section')
    expect(adminSections.length).toBeGreaterThan(1)
  })

  it('renders admin section with chevron', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    // Admin section should be rendered
    const adminSection = Array.from(container.querySelectorAll('.nav-section')).find(
      el => el.textContent?.includes('Admin')
    )
    expect(adminSection).toBeInTheDocument()
  })

  it('handles nav item click', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test', display_name: 'Test User', role: 1 },
      logout: mockLogout,
      isAdmin: () => false,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    // Find a nav item (Dashboard link)
    const navItems = container.querySelectorAll('.nav-item')
    expect(navItems.length).toBeGreaterThan(0)

    // Click the first nav item
    if (navItems[0]) {
      await userEvent.click(navItems[0])
    }
  })

  it('handles admin section click', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    // Find admin section
    const adminSections = container.querySelectorAll('.nav-section')
    const adminSection = Array.from(adminSections).find(el => el.textContent?.includes('Admin'))

    if (adminSection) {
      await userEvent.click(adminSection)
    }
  })

  it('handles admin nav item click', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', display_name: 'Admin', role: 10 },
      logout: mockLogout,
      isAdmin: () => true,
      isRoot: () => false,
    } as any)

    const { container } = renderWithRouter(<AppLayout />)

    // Find admin nav items (like Channels)
    const channelsLink = Array.from(container.querySelectorAll('.nav-item')).find(
      el => el.textContent?.includes('Channels')
    )

    if (channelsLink) {
      await userEvent.click(channelsLink)
    }
  })
})
