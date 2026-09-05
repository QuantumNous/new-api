import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  return (
    <>
      <div class="flex items-center border-b">
        <h2 class="text-xl p-2">Dashboard</h2>
        <Link
          to="/dashboard/posts/$postId"
          params={{
            postId: '3',
          }}
          class="py-1 px-2 text-xs bg-blue-500 text-white rounded-full"
        >
          1 New Invoice
        </Link>
      </div>
      <div class="flex flex-wrap divide-x">
        {(
          [
            ['.', 'Summary'],
            ['/dashboard/posts', 'Posts'],
          ] as const
        ).map(([to, label]) => {
          return (
            <Link
              from={Route.fullPath}
              to={to}
              activeOptions={{ exact: to === '.' }}
              activeProps={{ class: `font-bold` }}
              class="p-2"
            >
              {label}
            </Link>
          )
        })}
      </div>
      <hr />
      <Outlet />
    </>
  )
}
