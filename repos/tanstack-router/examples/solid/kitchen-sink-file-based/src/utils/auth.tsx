import { createStore } from 'solid-js/store'

export const [auth, setAuth] = createStore<Auth>({
  status: 'loggedOut',
  username: undefined,
  login: (username: string) => {
    setAuth({
      status: 'loggedIn',
      username,
    })
  },
  logout: () => {
    setAuth({
      status: 'loggedOut',
      username: undefined,
    })
  },
})

export type Auth = {
  login: (username: string) => void
  logout: () => void
  status: 'loggedOut' | 'loggedIn'
  username?: string
}
