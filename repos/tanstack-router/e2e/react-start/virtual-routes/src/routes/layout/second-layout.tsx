import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_first/_second-layout')({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <div>
      <div>I'm a nested layout</div>
      <div className="flex gap-2 border-b">
        <Link
          to="/route-without-file/layout-a"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Layout A
        </Link>
        <Link
          to="/route-without-file/layout-b"
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
