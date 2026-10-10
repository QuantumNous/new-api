import * as Solid from 'solid-js'

import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { flushSync } from 'react-dom'
import { auth } from './firebase/config'
import type { AuthProvider, User } from 'firebase/auth'

export type AuthContextType = {
  isAuthenticated: () => boolean
  isInitialLoading: () => boolean
  login: (provider: AuthProvider) => Promise<void>
  logout: () => Promise<void>
  user: () => User | null
}

const AuthContext = Solid.createContext<AuthContextType | null>(null)

export function AuthContextProvider(props: { children: Solid.JSX.Element }) {
  const [user, setUser] = Solid.createSignal<User | null>(auth.currentUser)
  const [isInitialLoading, setIsInitialLoading] = Solid.createSignal(true)
  const isAuthenticated = () => !!user()

  Solid.createEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      flushSync(() => {
        setUser(user)
        setIsInitialLoading(false)
      })
    })
    return () => unsubscribe()
  })

  const logout = async () => {
    console.log('Logging out...')
    await signOut(auth)
    setUser(null)
    setIsInitialLoading(false)
  }

  const login = async (provider: AuthProvider) => {
    const result = await signInWithPopup(auth, provider)
    flushSync(() => {
      setUser(result.user)
      setIsInitialLoading(false)
    })
  }

  return (
    <AuthContext.Provider
      value={{ isInitialLoading, isAuthenticated, user, login, logout }}
    >
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = Solid.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
