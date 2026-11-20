import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'
import { Link, Outlet, linkOptions } from '@tanstack/solid-router'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
  loader: () => ({
    crumb: 'Dashboard',
  }),
})

const options = [
  linkOptions({
    to: '/dashboard',
    label: 'Summary',
    activeOptions: { exact: true },
  }),
  linkOptions({
    to: '/dashboard/invoices',
    label: 'Invoices',
  }),
  linkOptions({
    to: '/dashboard/users',
    label: 'Users',
  }),
]

function DashboardComponent() {
  return (
    <>
      <div class="flex items-center border-b">
        <h2 class="text-xl p-2">Dashboard</h2>
      </div>

      <div class="flex flex-wrap divide-x">
        {options.map((option) => {
          return (
            <Link {...option} activeProps={{ class: `font-bold` }} class="p-2">
              {option.label}
            </Link>
          )
        })}
      </div>
      <hr />

      <Outlet />
    </>
  )
}
