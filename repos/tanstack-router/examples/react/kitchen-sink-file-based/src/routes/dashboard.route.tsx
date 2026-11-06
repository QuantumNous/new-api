import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link, Outlet, linkOptions } from '@tanstack/react-router'

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
      <div className="flex items-center border-b">
        <h2 className="text-xl p-2">Dashboard</h2>
      </div>

      <div className="flex flex-wrap divide-x">
        {options.map((option) => {
          return (
            <Link
              key={option.to}
              {...option}
              activeProps={{ className: `font-bold` }}
              className="p-2"
            >
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
