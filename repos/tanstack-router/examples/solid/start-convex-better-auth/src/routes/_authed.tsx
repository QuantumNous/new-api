import { Outlet, createFileRoute, redirect } from '@tanstack/solid-router'
import { fetchUser } from '~/library/server'

export const Route = createFileRoute('/_authed')({
  component: () => (
    <>
      <Outlet />
    </>
  ),
  beforeLoad: async (ctx) => {
    const user = await fetchUser()
    if (!ctx.context.token) {
      throw redirect({
        to: '/',
      })
    }
    return { user }
  },
})
