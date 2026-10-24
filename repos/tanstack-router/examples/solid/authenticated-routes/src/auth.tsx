import * as Solid from 'solid-js'

import { sleep } from './utils'

export interface AuthContext {
  isAuthenticated: () => boolean
  login: (username: string) => Promise<void>
  logout: () => Promise<void>
  user: () => string | null
}

const AuthContext = Solid.createContext<AuthContext | null>(null)

const key = 'tanstack.auth.user'

function getStoredUser() {
  return localStorage.getItem(key)
}

function setStoredUser(user: string | null) {
  if (user) {
    localStorage.setItem(key, user)
  } else {
    localStorage.removeItem(key)
  }
}

export function AuthProvider(props: { children: Solid.JSX.Element }) {
  const [user, setUser] = Solid.createSignal<string | null>(getStoredUser())
  const isAuthenticated = () => !!user()

  const logout = async () => {
    await sleep(250)

    setStoredUser(null)
    setUser(null)
  }

  const login = async (username: string) => {
    await sleep(500)

    setStoredUser(username)
    setUser(username)
  }

  Solid.createEffect(() => {
    setUser(getStoredUser())
  })

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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
