import { create } from 'zustand'
import { api, saveAuth, clearAuth, hasAuthToken, type User } from './api'

interface LoginData {
  id: number
  username: string
  display_name: string
  role: number
  status: number
  group: string
}

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  init: () => Promise<void>
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  isAdmin: () => boolean
  isRoot: () => boolean
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    if (!hasAuthToken()) {
      set({ user: null, initialized: true })
      return
    }
    try {
      const user = await api.get<User>('/api/user/self')
      set({ user, initialized: true })
    } catch {
      clearAuth()
      set({ user: null, initialized: true })
    }
  },

  refresh: async () => {
    if (!hasAuthToken()) return
    try {
      const user = await api.get<User>('/api/user/self')
      set({ user })
    } catch {}
  },

  login: async (username: string, password: string) => {
    set({ loading: true })
    try {
      // Step 1: login → returns user id + sets session cookie
      const loginData = await api.post<LoginData>('/api/user/login', { username, password })
      // Step 2: save id temporarily so getAuthHeaders includes New-Api-User
      saveAuth('', loginData.id)
      // Step 3: generate access token (session cookie + New-Api-User header)
      const token = await api.get<string>('/api/user/token')
      // Step 4: save real token
      saveAuth(token, loginData.id)
      // Step 5: get full user info
      const user = await api.get<User>('/api/user/self')
      set({ user, loading: false, initialized: true })
      return user
    } catch (e) {
      clearAuth()
      set({ loading: false })
      throw e
    }
  },

  logout: async () => {
    try { await api.get('/api/user/logout') } catch {}
    clearAuth()
    set({ user: null, initialized: false })
  },

  isAdmin: () => {
    const u = get().user
    return u !== null && u.role >= 10
  },

  isRoot: () => {
    const u = get().user
    return u !== null && u.role >= 100
  },
}))
