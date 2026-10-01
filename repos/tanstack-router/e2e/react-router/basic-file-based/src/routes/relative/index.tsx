import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-2">
      <div className="border-b" data-testid="relative-routing-home">
        Relative Routing Tests - Home
      </div>
      <div>
        <Link to="/relative/link">Using Links</Link>
        <Link to="/relative/useNavigate">Using useNavigate</Link>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
