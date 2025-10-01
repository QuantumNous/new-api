import { create } from 'zustand'

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
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  // 从 localStorage 恢复 user 信息
  const initUser = (() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('user')
        return saved ? JSON.parse(saved) : null
      }
    } catch {
      // 解析失败时清除脏数据
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user')
      }
    }
    return null
  })()

  return {
    auth: {
      user: initUser,
      setUser: (user) =>
        set((state) => {
          // 持久化 user 到 localStorage
          if (typeof window !== 'undefined') {
            if (user) {
              window.localStorage.setItem('user', JSON.stringify(user))
            } else {
              window.localStorage.removeItem('user')
            }
          }
          return { ...state, auth: { ...state.auth, user } }
        }),
      reset: () =>
        set((state) => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('user')
          }
          return {
            ...state,
            auth: { ...state.auth, user: null },
          }
        }),
    },
  }
})
