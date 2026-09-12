import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useRouter } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: LoginComponent,
})

function LoginComponent() {
  const router = useRouter()
  const { auth, status } = Route.useRouteContext({
    select: ({ auth }) => ({ auth, status: auth.status }),
  })
  const search = Route.useSearch()
  const [username, setUsername] = React.useState('')

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    auth.login(username)
    router.invalidate()
  }

  // Ah, the subtle nuances of client side auth. 🙄
  React.useLayoutEffect(() => {
    if (status === 'loggedIn' && search.redirect) {
      router.history.push(search.redirect)
    }
  }, [status, search.redirect])

  return status === 'loggedIn' ? (
    <div>
      Logged in as <strong>{auth.username}</strong>
      <div className="h-2" />
      <button
        onClick={() => {
          auth.logout()
          router.invalidate()
        }}
        className="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
      >
        Log out
      </button>
      <div className="h-2" />
    </div>
  ) : (
    <div className="p-2">
      <div>You must log in!</div>
      <div className="h-2" />
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="border p-1 px-2 rounded-sm"
        />
        <button
          type="submit"
          className="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
        >
          Login
        </button>
      </form>
    </div>
  )
}
