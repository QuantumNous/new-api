import { redirect, createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'

import { useAppSession } from '~/utils/session'

const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useAppSession()

  session.clear()

  throw redirect({
    href: '/',
  })
})

export const Route = createFileRoute('/logout')({
  preload: false,
  loader: () => logoutFn(),
})
