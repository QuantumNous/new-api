import { createFileRoute } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(group)/_layout')({
  component: () => (
    <>
      <div>/(group)/_layout!</div>
      <Outlet />
    </>
  ),
})
