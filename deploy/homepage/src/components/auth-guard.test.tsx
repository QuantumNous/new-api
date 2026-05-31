import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import * as useAuthModule from '../lib/auth'
import { AuthGuard, AdminGuard, RootGuard } from './auth-guard'

// Mock auth module
vi.mock('../lib/auth', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuthModule.useAuth)

// Helper component to track current location
function LocationTracker({ pathname }: { pathname: string }) {
  return <div data-testid="location">{pathname}</div>
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading when not initialized', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      initialized: false,
      init: vi.fn(),
    } as any)

    render(
      <MemoryRouter>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </MemoryRouter>
    )

    expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument()
    expect(document.querySelector('.page-loading')).toBeInTheDocument()
  })

  it('calls init when not initialized', () => {
    const initFn = vi.fn()
    mockUseAuth.mockReturnValue({
      user: null,
      initialized: false,
      init: initFn,
    } as any)

    render(
      <MemoryRouter>
        <AuthGuard>
          <div>Protected</div>
        </AuthGuard>
      </MemoryRouter>
    )

    expect(initFn).toHaveBeenCalled()
  })

  it('shows loading when initialized but no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      initialized: true,
      init: vi.fn(),
    } as any)

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </MemoryRouter>
    )

    expect(document.querySelector('.page-loading')).toBeInTheDocument()
  })

  it('renders loading spinner instead of children when no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      initialized: true,
      init: vi.fn(),
    } as any)

    const { container } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </MemoryRouter>
    )

    expect(container.querySelector('.spinner')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'test' },
      initialized: true,
      init: vi.fn(),
    } as any)

    render(
      <MemoryRouter>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(document.querySelector('.page-loading')).not.toBeInTheDocument()
  })
})

describe('AdminGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function LocationDisplay() {
    const location = useLocation()
    return <div data-testid="current-path">{location.pathname}</div>
  }

  it('shows loading when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      initialized: true,
      init: vi.fn(),
      isAdmin: () => false,
    } as any)

    const { container } = render(
      <MemoryRouter initialEntries={['/admin/channels']}>
        <LocationDisplay />
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      </MemoryRouter>
    )

    expect(container.querySelector('.spinner')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('renders children initially when authenticated but not admin (navigation is async)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 1 }, // Regular user
      initialized: true,
      init: vi.fn(),
      isAdmin: () => false,
    } as any)

    render(
      <MemoryRouter initialEntries={['/admin/channels']}>
        <LocationDisplay />
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      </MemoryRouter>
    )

    // Children render immediately because user exists
    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('renders children for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 10 }, // Admin
      initialized: true,
      init: vi.fn(),
      isAdmin: () => true,
    } as any)

    render(
      <MemoryRouter>
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      </MemoryRouter>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('renders children for root users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 100 }, // Root
      initialized: true,
      init: vi.fn(),
      isAdmin: () => true,
    } as any)

    render(
      <MemoryRouter>
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      </MemoryRouter>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })
})

describe('RootGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function LocationDisplay() {
    const location = useLocation()
    return <div data-testid="current-path">{location.pathname}</div>
  }

  it('shows loading when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      initialized: true,
      init: vi.fn(),
      isRoot: () => false,
    } as any)

    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <LocationDisplay />
        <RootGuard>
          <div>Root Content</div>
        </RootGuard>
      </MemoryRouter>
    )

    expect(container.querySelector('.spinner')).toBeInTheDocument()
    expect(screen.queryByText('Root Content')).not.toBeInTheDocument()
  })

  it('renders children initially when authenticated but not root (navigation is async)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 10 }, // Admin but not root
      initialized: true,
      init: vi.fn(),
      isRoot: () => false,
    } as any)

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <LocationDisplay />
        <RootGuard>
          <div>Root Content</div>
        </RootGuard>
      </MemoryRouter>
    )

    // Children render immediately because user exists
    // Navigation happens asynchronously in useEffect
    expect(screen.getByText('Root Content')).toBeInTheDocument()
  })

  it('renders children for root users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 100 }, // Root
      initialized: true,
      init: vi.fn(),
      isRoot: () => true,
    } as any)

    render(
      <MemoryRouter>
        <RootGuard>
          <div>Root Content</div>
        </RootGuard>
      </MemoryRouter>
    )

    expect(screen.getByText('Root Content')).toBeInTheDocument()
  })
})
