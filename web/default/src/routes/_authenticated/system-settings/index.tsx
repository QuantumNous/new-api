import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/system-settings/')({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/site',
    })
  },
})
