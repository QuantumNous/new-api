import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pathless-layout/_layout')({
  component: () => (
    <div>
      <div data-testid="pathless-layout-wrapper">Pathless Layout Wrapper</div>
      <nav>
        <Link to="/pathless-layout/child" data-testid="link-to-child">
          Go to Child
        </Link>
      </nav>
      <Outlet />
    </div>
  ),
})
