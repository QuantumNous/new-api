import { createFileRoute } from '@tanstack/solid-router'
import { Login } from '~/components/Login'

export const Route = createFileRoute('/login')({
  component: LoginComp,
})

function LoginComp() {
  return <Login />
}
