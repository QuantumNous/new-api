import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/livestock/$farmId/medicine')({
  component: () => <Outlet />,
})
