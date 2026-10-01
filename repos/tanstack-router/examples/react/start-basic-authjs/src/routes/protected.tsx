import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/protected')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: Protected,
})

function Protected() {
  const { session } = Route.useRouteContext()
  const user = session?.user

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Protected Page</h1>
      <p className="text-gray-600 mb-8">
        This page is only accessible to authenticated users.
      </p>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-green-800">
          Welcome, {user?.name ?? 'User'}!
        </h2>

        {user && (
          <div className="space-y-2 text-green-700">
            <p>
              <strong>Email:</strong> {user?.email ?? 'N/A'}
            </p>
            {user?.image && (
              <div>
                <strong>Avatar:</strong>
                <img
                  src={user.image}
                  alt="User avatar"
                  className="w-20 h-20 rounded-full mt-2"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">Session Data (Debug)</h3>
        <pre className="text-xs overflow-auto bg-gray-800 text-green-400 p-4 rounded">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  )
}
