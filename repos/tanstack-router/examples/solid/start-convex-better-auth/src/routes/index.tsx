import { createFileRoute, redirect } from '@tanstack/solid-router'

import LoginSignupForm from '~/components/login-signup-form'

export const Route = createFileRoute('/')({
  beforeLoad: (ctx) => {
    if (ctx.context.token) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main>
      <LoginSignupForm />
    </main>
  )
}
