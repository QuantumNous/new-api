import * as Solid from 'solid-js'
import {
  createFileRoute,
  redirect,
  useRouter,
  useRouterState,
} from '@tanstack/solid-router'
import { z } from 'zod'

import { useAuth } from '../auth'
import { sleep } from '../utils'

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const fallback = '/dashboard' as const

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(''),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: search.redirect || fallback })
    }
  },
  component: LoginComponent,
})

function LoginComponent() {
  const auth = useAuth()
  const router = useRouter()
  const isLoading = useRouterState({ select: (s) => s.isLoading })
  const navigate = Route.useNavigate()
  const [isSubmitting, setIsSubmitting] = Solid.createSignal(false)

  const search = Route.useSearch()

  const onFormSubmit = async (evt: any) => {
    setIsSubmitting(true)
    try {
      evt.preventDefault()
      const data = new FormData(evt.currentTarget)
      const fieldValue = data.get('username')

      if (!fieldValue) return
      const username = fieldValue.toString()
      await auth.login(username)

      await router.invalidate()

      // This is just a hack being used to wait for the auth state to update
      // in a real app, you'd want to use a more robust solution
      await sleep(1)

      await navigate({ to: search().redirect || fallback })
    } catch (error) {
      console.error('Error logging in: ', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLoggingIn = isLoading() || isSubmitting()

  return (
    <div class="p-2 grid gap-2 place-items-center">
      <h3 class="text-xl">Login page</h3>
      {search().redirect ? (
        <p class="text-red-500">You need to login to access this page.</p>
      ) : (
        <p>Login to see all the cool content in here.</p>
      )}
      <form class="mt-4 max-w-lg" onSubmit={onFormSubmit}>
        <fieldset disabled={isLoggingIn} class="w-full grid gap-2">
          <div class="grid gap-2 items-center min-w-[300px]">
            <label for="username-input" class="text-sm font-medium">
              Username
            </label>
            <input
              id="username-input"
              name="username"
              placeholder="Enter your name"
              type="text"
              class="border rounded-md p-2 w-full"
              required
            />
          </div>
          <button
            type="submit"
            class="bg-blue-500 text-white py-2 px-4 rounded-md w-full disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isLoggingIn ? 'Loading...' : 'Login'}
          </button>
        </fieldset>
      </form>
    </div>
  )
}
