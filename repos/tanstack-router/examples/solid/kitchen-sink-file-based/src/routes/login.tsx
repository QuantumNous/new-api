import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'
import { useRouter } from '@tanstack/solid-router'
import { z } from 'zod'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
}).update({
  component: LoginComponent,
})

function LoginComponent() {
  const router = useRouter()

  const context = Route.useRouteContext({
    select: ({ auth }) => ({ auth, status: auth.status }),
  })

  const search = Route.useSearch()
  const [username, setUsername] = Solid.createSignal('')

  const onSubmit = (e: any) => {
    e.preventDefault()
    context().auth.login(username())
    router.invalidate()
  }

  // Ah, the subtle nuances of client side auth. 🙄
  Solid.createEffect(() => {
    if (context().status === 'loggedIn' && search().redirect) {
      router.history.push(search().redirect!)
    }
  })

  return (
    <Solid.Show
      when={context().auth.status === 'loggedIn'}
      fallback={
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
      }
    >
      <div>
        Logged in as <strong>{context().auth.username}</strong>
        <div class="h-2" />
        <button
          onClick={() => {
            context().auth.logout()
            router.invalidate()
          }}
          class="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
        >
          Log out
        </button>
        <div class="h-2" />
      </div>
    </Solid.Show>
  )
}
