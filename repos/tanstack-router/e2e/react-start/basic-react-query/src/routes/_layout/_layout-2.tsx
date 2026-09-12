import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_layout-2')({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <div>
      <div>I'm a nested layout</div>
      <div className="flex gap-2">
        <Link
          to="/layout-a"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Layout A
        </Link>
        <Link
          to="/layout-b"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Layout B
        </Link>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
