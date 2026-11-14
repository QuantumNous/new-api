import { createFileRoute } from '@tanstack/solid-router'
import { Show } from 'solid-js'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const routeContext = Route.useRouteContext()

  return (
    <div class="max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold mb-4">TanStack Start Auth.js Example</h1>
      <p class="text-gray-600 mb-8">
        This example demonstrates auth.js integration with TanStack Start using
        Auth0 OAuth.
      </p>

      <div class="bg-gray-50 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Auth Status</h2>

        <Show
          when={routeContext().session}
          fallback={
            <p class="text-gray-500">
              You are not signed in. Click "Sign In" in the navigation bar to
              authenticate with Auth0.
            </p>
          }
        >
          {(session) => (
            <div class="space-y-2">
              <p class="text-green-600 font-medium">Authenticated</p>
              <Show when={session().user?.image}>
                {(image) => (
                  <img
                    src={image()}
                    alt="Avatar"
                    class="w-16 h-16 rounded-full"
                  />
                )}
              </Show>
              <p>
                <strong>Name:</strong> {session().user?.name ?? 'N/A'}
              </p>
              <p>
                <strong>Email:</strong> {session().user?.email ?? 'N/A'}
              </p>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
