import { createFileRoute, redirect } from '@tanstack/solid-router'
import { Show } from 'solid-js'

export const Route = createFileRoute('/protected')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: Protected,
})

function Protected() {
  const routeContext = Route.useRouteContext()

  return (
    <div class="max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold mb-4">Protected Page</h1>
      <p class="text-gray-600 mb-8">
        This page is only accessible to authenticated users.
      </p>

      <div class="bg-green-50 border border-green-200 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4 text-green-800">
          Welcome, {routeContext().session?.user?.name ?? 'User'}!
        </h2>

        <Show when={routeContext().session?.user}>
          {(user) => (
            <div class="space-y-2 text-green-700">
              <p>
                <strong>Email:</strong> {user().email ?? 'N/A'}
              </p>
              <Show when={user().image}>
                {(image) => (
                  <div>
                    <strong>Avatar:</strong>
                    <img
                      src={image()}
                      alt="User avatar"
                      class="w-20 h-20 rounded-full mt-2"
                    />
                  </div>
                )}
              </Show>
            </div>
          )}
        </Show>
      </div>

      <div class="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 class="font-semibold mb-2">Session Data (Debug)</h3>
        <pre class="text-xs overflow-auto bg-gray-800 text-green-400 p-4 rounded">
          {JSON.stringify(routeContext().session, null, 2)}
        </pre>
      </div>
    </div>
  )
}
