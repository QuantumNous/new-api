import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  return (
    <>
      <div class="flex items-center border-b">
        <h2 class="text-xl p-2">Dashboard</h2>
      </div>
      <div class="flex flex-wrap divide-x">
        {(
          [
            ['/dashboard', 'Summary', true],
            ['/dashboard/invoices', 'Invoices'],
            ['/dashboard/users', 'Users'],
          ] as const
        ).map(([to, label, exact]) => {
          return (
            <Link
              to={to}
              activeOptions={{ exact }}
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
