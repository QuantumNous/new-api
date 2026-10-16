import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/livestock/$farmId/medicine/_form')({
  component: () => <Outlet />,
})
