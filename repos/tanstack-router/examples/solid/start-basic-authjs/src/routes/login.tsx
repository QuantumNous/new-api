import { createFileRoute, redirect } from '@tanstack/solid-router'
import { createResource, Suspense } from 'solid-js'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    // Redirect if already authenticated
    if (context.session) {
      throw redirect({ to: '/' })
    }
  },
  component: Login,
})

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf')
  const data = await res.json()
  return data.csrfToken
}

function Login() {
  const [csrfToken] = createResource(getCsrfToken)

  return (
    <div class="max-w-md mx-auto mt-10">
      <h1 class="text-2xl font-bold mb-6 text-center">Sign In</h1>

      <div class="space-y-4">
        <Suspense fallback={<div class="text-center">Loading...</div>}>
          <form action="/api/auth/signin/auth0" method="POST">
            <input type="hidden" name="csrfToken" value={csrfToken() ?? ''} />
            <input type="hidden" name="callbackUrl" value="/" />
            <button
              type="submit"
              class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.98 7.448L19.62 0H4.347L2.02 7.448c-1.352 4.312.03 9.206 3.815 12.015L12.007 24l6.157-4.552c3.755-2.81 5.182-7.688 3.815-12.015l-6.16 4.58 2.343 7.45-6.157-4.597-6.158 4.58 2.358-7.433-6.188-4.55 7.63-.045L12.008 0l2.356 7.404 7.615.044z" />
              </svg>
              Continue with Auth0
            </button>
          </form>
        </Suspense>

        <p class="text-center text-sm text-gray-500 mt-4">
          You'll be redirected to Auth0 to complete the sign-in process.
        </p>
      </div>
    </div>
  )
}
