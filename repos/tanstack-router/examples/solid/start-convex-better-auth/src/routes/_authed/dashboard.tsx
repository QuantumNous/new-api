import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from '@tanstack/solid-router'
import { useQuery } from 'convex-solidjs'
import { api } from 'convex/_generated/api'
import { For, Show } from 'solid-js'
import { addNumber } from '~/library/server'
import { authClient } from '~/library/auth-client'

export const Route = createFileRoute('/_authed/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const context = useRouteContext({ from: '/_authed' })
  // example of a Convex query
  const { data } = useQuery(api.myFunctions.listNumbers, { count: 10 })

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate({ to: '/' })
  }

  return (
    <main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
              <Show when={context().user}>
                {(u) => (
                  <p class="text-sm text-gray-600 mt-1">
                    Welcome back, {u().name || u().email}!
                  </p>
                )}
              </Show>
            </div>
            <button
              onClick={handleSignOut}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Numbers Card */}
        <div class="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900">Numbers</h2>
            <button
              onClick={() => addNumber()}
              class="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Add Random Number To Convex
            </button>
          </div>

          <Show
            when={data()?.numbers && data()!.numbers.length > 0}
            fallback={
              <div class="text-center py-12">
                <svg
                  class="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">
                  No numbers yet
                </h3>
                <p class="mt-1 text-sm text-gray-500">
                  Get started by adding your first number.
                </p>
              </div>
            }
          >
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <For each={data()?.numbers}>
                {(number) => (
                  <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 text-center border border-blue-100 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                    <div class="text-2xl font-bold text-blue-600">{number}</div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </main>
  )
}
