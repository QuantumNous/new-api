import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const user = session?.user

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">
        TanStack Start Auth.js Example
      </h1>
      <p className="text-gray-600 mb-8">
        This example demonstrates auth.js integration with TanStack Start using
        Auth0 OAuth.
      </p>

      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Auth Status</h2>

        {session ? (
          <div className="space-y-2">
            <p className="text-green-600 font-medium">Authenticated</p>
            {user?.image && (
              <img
                src={user.image}
                alt="Avatar"
                className="w-16 h-16 rounded-full"
              />
            )}
            <p>
              <strong>Name:</strong> {user?.name ?? 'N/A'}
            </p>
            <p>
              <strong>Email:</strong> {user?.email ?? 'N/A'}
            </p>
          </div>
        ) : (
          <p className="text-gray-500">
            You are not signed in. Click "Sign In" in the navigation bar to
            authenticate with Auth0.
          </p>
        )}
      </div>
    </div>
  )
}
