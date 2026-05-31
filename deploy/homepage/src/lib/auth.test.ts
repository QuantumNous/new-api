import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuth } from './auth'
import * as apiModule from './api'

// Mock api module partially
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
    saveAuth: vi.fn(),
    clearAuth: vi.fn(),
  }
})

const mockApi = vi.mocked(apiModule.api)

describe('useAuth store', () => {
  const mockSaveAuth = vi.mocked(apiModule.saveAuth)
  const mockClearAuth = vi.mocked(apiModule.clearAuth)

  beforeEach(() => {
    // Reset store before each test
    useAuth.setState({
      user: null,
      loading: false,
      initialized: false,
    })
    vi.clearAllMocks()
  })

  it('has initial state', () => {
    const state = useAuth.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.initialized).toBe(false)
  })

  describe('init', () => {
    it('sets initialized true when no auth token', async () => {
      // No token in localStorage - hasAuthToken returns false
      await useAuth.getState().init()

      const state = useAuth.getState()
      expect(state.user).toBeNull()
      expect(state.initialized).toBe(true)
      expect(mockApi.get).not.toHaveBeenCalled()
    })

    it('calls clearAuth when token exists but API fails', async () => {
      localStorage.setItem('vynex-user-id', '123')
      vi.mocked(mockApi.get).mockRejectedValue(new Error('API Error'))

      await useAuth.getState().init()

      const state = useAuth.getState()
      expect(state.user).toBeNull()
      expect(state.initialized).toBe(true)
      expect(mockClearAuth).toHaveBeenCalled()
    })

    it('skips if already initialized', async () => {
      useAuth.setState({ initialized: true })

      await useAuth.getState().init()

      expect(mockApi.get).not.toHaveBeenCalled()
    })

    it('loads user data when auth token exists', async () => {
      localStorage.setItem('vynex-user-id', '123')
      vi.mocked(mockApi.get).mockResolvedValue({
        id: 1,
        username: 'test',
        quota: 1000000,
        used_quota: 0,
        request_count: 0,
      })

      await useAuth.getState().init()

      const state = useAuth.getState()
      expect(state.user).not.toBeNull()
      expect(state.user?.username).toBe('test')
      expect(state.initialized).toBe(true)
    })
  })

  describe('refresh', () => {
    it('updates user data', async () => {
      localStorage.setItem('vynex-user-id', '123')
      const mockUser = {
        id: 1,
        username: 'test',
        quota: 500000,
        used_quota: 100,
        request_count: 5,
      }
      vi.mocked(mockApi.get).mockResolvedValue(mockUser)

      await useAuth.getState().refresh()

      const state = useAuth.getState()
      expect(state.user).toEqual(mockUser)
    })
  })

  describe('login', () => {
    it('logs in user and saves auth', async () => {
      const loginData = { id: 2, username: 'testuser' }
      const token = 'test-token'
      const userData = {
        id: 2,
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        role: 1,
        status: 1,
        group: 'default',
        quota: 1000000,
        used_quota: 0,
        request_count: 0,
        aff_code: 'ABC',
        invite_url: '',
        access_token: '',
      }

      vi.mocked(mockApi.post).mockResolvedValueOnce(loginData)
      vi.mocked(mockApi.get).mockResolvedValueOnce(token)
      vi.mocked(mockApi.get).mockResolvedValueOnce(userData)

      const result = await useAuth.getState().login('testuser', 'password')

      expect(mockApi.post).toHaveBeenCalledWith('/api/user/login', {
        username: 'testuser',
        password: 'password',
      })
      expect(mockSaveAuth).toHaveBeenCalledWith('', 2)
      expect(mockApi.get).toHaveBeenCalledWith('/api/user/token')
      expect(mockSaveAuth).toHaveBeenCalledWith(token, 2)
      expect(result).toEqual(userData)

      const state = useAuth.getState()
      expect(state.user).toEqual(userData)
      expect(state.loading).toBe(false)
      expect(state.initialized).toBe(true)
    })

    it('clears auth and resets state on login failure', async () => {
      vi.mocked(mockApi.post).mockRejectedValueOnce(new Error('Invalid credentials'))

      await expect(useAuth.getState().login('user', 'wrong')).rejects.toThrow()

      expect(mockClearAuth).toHaveBeenCalled()

      const state = useAuth.getState()
      expect(state.loading).toBe(false)
      expect(state.user).toBeNull()
    })
  })

  describe('logout', () => {
    it('logs out user', async () => {
      localStorage.setItem('vynex-user-id', '123')
      vi.mocked(mockApi.get).mockResolvedValueOnce(undefined)

      useAuth.setState({ user: { id: 1, username: 'test' } as any })

      await useAuth.getState().logout()

      expect(mockApi.get).toHaveBeenCalledWith('/api/user/logout')
      expect(mockClearAuth).toHaveBeenCalled()

      const state = useAuth.getState()
      expect(state.user).toBeNull()
      expect(state.initialized).toBe(false)
    })

    it('handles logout API error gracefully', async () => {
      localStorage.setItem('vynex-user-id', '123')
      vi.mocked(mockApi.get).mockRejectedValueOnce(new Error('Network error'))

      await expect(useAuth.getState().logout()).resolves.not.toThrow()

      expect(mockClearAuth).toHaveBeenCalled()
      expect(useAuth.getState().user).toBeNull()
    })
  })

  describe('isAdmin', () => {
    it('returns false when no user', () => {
      expect(useAuth.getState().isAdmin()).toBe(false)
    })

    it('returns false for regular user', () => {
      useAuth.setState({ user: { role: 1 } as any })
      expect(useAuth.getState().isAdmin()).toBe(false)
    })

    it('returns true for admin', () => {
      useAuth.setState({ user: { role: 10 } as any })
      expect(useAuth.getState().isAdmin()).toBe(true)
    })

    it('returns true for root', () => {
      useAuth.setState({ user: { role: 100 } as any })
      expect(useAuth.getState().isAdmin()).toBe(true)
    })
  })

  describe('isRoot', () => {
    it('returns false when no user', () => {
      expect(useAuth.getState().isRoot()).toBe(false)
    })

    it('returns false for admin', () => {
      useAuth.setState({ user: { role: 10 } as any })
      expect(useAuth.getState().isRoot()).toBe(false)
    })

    it('returns true for root', () => {
      useAuth.setState({ user: { role: 100 } as any })
      expect(useAuth.getState().isRoot()).toBe(true)
    })
  })
})
