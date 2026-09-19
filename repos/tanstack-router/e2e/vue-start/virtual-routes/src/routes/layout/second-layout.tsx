import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/_first/_second-layout')({
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <div>
      <div>I'm a nested layout</div>
      <div class="flex gap-2 border-b">
        <Link
          to="/route-without-file/layout-a"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Layout A
        </Link>
        <Link
          to="/route-without-file/layout-b"
          activeProps={{
            class: 'font-bold',
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
