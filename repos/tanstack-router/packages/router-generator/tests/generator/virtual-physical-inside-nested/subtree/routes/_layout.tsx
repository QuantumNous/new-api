import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/s1/_layout')({
  component: () => <Outlet />,
})
