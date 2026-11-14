import * as Solid from 'solid-js'
import { createFileRoute, useRouter } from '@tanstack/solid-router'
import { z } from 'zod'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: LoginComponent,
})

function LoginComponent() {
  const router = useRouter()
  const routeContext: Solid.Accessor<{ auth: any; status: any }> =
    Route.useRouteContext({
      select: ({ auth }: { auth: any }) => ({ auth, status: auth.status }),
    })
  const search = Route.useSearch()
  const [username, setUsername] = Solid.createSignal('')

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    routeContext().auth.login(username())
    router.invalidate()
  }

  // Ah, the subtle nuances of client side auth. 🙄
  Solid.createRenderEffect(() => {
    if (routeContext().status === 'loggedIn' && search().redirect) {
      router.history.push(search().redirect || '')
    }
  }, [routeContext().status, search().redirect])

  return routeContext().status === 'loggedIn' ? (
    <div>
      Logged in as <strong>{routeContext().auth.username}</strong>
      <div class="h-2" />
      <button
        onClick={() => {
          routeContext().auth.logout()
          router.invalidate()
        }}
        class="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
      >
        Log out
      </button>
      <div class="h-2" />
    </div>
  ) : (
    <div class="p-2">
      <div>You must log in!</div>
      <div class="h-2" />
      <form onSubmit={onSubmit} class="flex gap-2">
        <input
          value={username()}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          class="border p-1 px-2 rounded-sm"
        />
        <button
          type="submit"
          class="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
        >
          Login
        </button>
      </form>
    </div>
  )
}
