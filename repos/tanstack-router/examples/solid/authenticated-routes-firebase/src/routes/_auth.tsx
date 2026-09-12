import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/solid-router'
import { useAuth } from '../auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) => {
    // Check if user is authenticated
    if (!context.auth.isAuthenticated()) {
      console.log('User not authenticated, redirecting to login...')
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
    console.log('User authenticated, proceeding...')
  },
  component: AuthLayout,
})

function AuthLayout() {
  const router = useRouter()
  const navigate = Route.useNavigate()
  const auth = useAuth()

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      auth.logout().then(() => {
        router.invalidate().finally(() => {
          navigate({ to: '/login' })
        })
      })
    }
  }

  return (
    <div class="p-2 h-full">
      <h1>Authenticated Route</h1>
      <p>This route's content is only visible to authenticated users.</p>
      <ul class="py-2 flex gap-2">
        <li>
          <Link
            to="/dashboard"
            class="hover:underline data-[status='active']:font-semibold"
          >
            Dashboard
          </Link>
        </li>
        <li>
          <Link
            to="/invoices"
            class="hover:underline data-[status='active']:font-semibold"
          >
            Invoices
          </Link>
        </li>
        <li>
          <button type="button" class="hover:underline" onClick={handleLogout}>
            Logout
          </button>
        </li>
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
