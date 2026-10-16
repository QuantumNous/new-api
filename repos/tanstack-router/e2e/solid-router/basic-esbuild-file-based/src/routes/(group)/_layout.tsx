import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/(group)/_layout')({
  component: () => (
    <>
      <div>/(group)/_layout!</div>
      <Outlet />
    </>
  ),
})
