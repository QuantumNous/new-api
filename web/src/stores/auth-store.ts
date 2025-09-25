import type {
  LoginResponse,
  Verify2FAResponse,
  SelfResponse,
  UserBasic,
} from '@/types/api'
import { create } from 'zustand'
import { clearStoredUser, setStoredUser } from '@/lib/auth'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import { get, post } from '@/lib/http'

const ACCESS_TOKEN = 'thisisjustarandomstring'

interface AuthUser {
  accountNo: string
  email: string
  role: string[]
  exp: number
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    login: (payload: {
      username: string
      password: string
      turnstile?: string
    }) => Promise<{ require2FA?: boolean }>
    verify2FA: (code: string) => Promise<void>
    fetchSelf: () => Promise<void>
    logout: () => Promise<void>
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  const initToken = cookieState ? JSON.parse(cookieState) : ''
  return {
    auth: {
      user: null,
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      login: async ({ username, password, turnstile }) => {
        const qs = turnstile
          ? `?turnstile=${encodeURIComponent(turnstile)}`
          : ''
        const res = await post<LoginResponse>(`/api/user/login${qs}`, {
          username,
          password,
        })
        if (!res.success) throw new Error(res.message || '登录失败')
        const data = res.data
        if (data && (data as any).require_2fa) {
          return { require2FA: true }
        }
        const user = data as UserBasic
        setStoredUser(user)
        set((state) => ({
          ...state,
          auth: {
            ...state.auth,
            user: {
              accountNo: String(user.id),
              email: user.username,
              role: ['user'],
              exp: Date.now() + 24 * 60 * 60 * 1000,
            },
          },
        }))
        return {}
      },
      verify2FA: async (code: string) => {
        const res = await post<Verify2FAResponse>('/api/user/login/2fa', {
          code,
        })
        if (!res.success) throw new Error(res.message || '验证失败')
        const user = res.data as UserBasic
        setStoredUser(user)
        set((state) => ({
          ...state,
          auth: {
            ...state.auth,
            user: {
              accountNo: String(user.id),
              email: user.username,
              role: ['user'],
              exp: Date.now() + 24 * 60 * 60 * 1000,
            },
          },
        }))
      },
      fetchSelf: async () => {
        const res = await get<SelfResponse>('/api/user/self')
        if (!res.success) return
        const user = res.data!
        setStoredUser(user)
        set((state) => ({
          ...state,
          auth: {
            ...state.auth,
            user: {
              accountNo: String(user.id),
              email: (user as any).email || user.username,
              role: ['user'],
              exp: Date.now() + 24 * 60 * 60 * 1000,
            },
          },
        }))
      },
      logout: async () => {
        try {
          await get('/api/user/logout')
        } catch {
          /* ignore */
        }
        clearStoredUser()
        set((state) => ({ ...state, auth: { ...state.auth, user: null } }))
      },
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          clearStoredUser()
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})
