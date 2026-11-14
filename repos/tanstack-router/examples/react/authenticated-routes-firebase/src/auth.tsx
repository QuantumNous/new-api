import * as React from 'react'

import {
  onAuthStateChanged,
  type User,
  type AuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { flushSync } from 'react-dom'
import { auth } from './firebase/config'

export type AuthContextType = {
  isAuthenticated: boolean
  isInitialLoading: boolean
  login: (provider: AuthProvider) => Promise<void>
  logout: () => Promise<void>
  user: User | null
}

const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = React.useState<User | null>(auth.currentUser)
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  const isAuthenticated = !!user

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      flushSync(() => {
        setUser(user)
        setIsInitialLoading(false)
      })
    })
    return () => unsubscribe()
  }, [])

  const logout = React.useCallback(async () => {
    console.log('Logging out...')
    await signOut(auth)
    setUser(null)
    setIsInitialLoading(false)
  }, [])

  const login = React.useCallback(async (provider: AuthProvider) => {
    const result = await signInWithPopup(auth, provider)
    flushSync(() => {
      setUser(result.user)
      setIsInitialLoading(false)
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{ isInitialLoading, isAuthenticated, user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
