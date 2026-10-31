import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div class="p-2 grid gap-2">
      <h1 class="text-xl">Welcome!</h1>
      <p class="py-4 px-2 italic bg-slate-100 dark:bg-slate-800">
        <strong class="text-red-500">IMPORTANT!!!</strong> This is just an
        example of how to use authenticated routes with TanStack Router.
        <br />
        This is NOT an example how you'd write a production-level authentication
        system.
        <br />
        You'll need to take the concepts and patterns used in this example and
        adapt then to work with your authentication flow/system for your app.
      </p>
      <p>
        You are currently on the index route of the{' '}
        <strong>authenticated-routes</strong> example.
      </p>
      <p>You can try going through these options.</p>
      <ol class="list-disc list-inside px-2">
        <li>
          <Link to="/login" class="text-blue-500 hover:opacity-75">
            Go to the public login page.
          </Link>
        </li>
        <li>
          <Link to="/dashboard" class="text-blue-500 hover:opacity-75">
            Go to the auth-only dashboard page.
          </Link>
        </li>
        <li>
          <Link to="/invoices" class="text-blue-500 hover:opacity-75">
            Go to the auth-only invoices page.
          </Link>
        </li>
      </ol>
    </div>
  )
}
