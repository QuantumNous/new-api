import { createFileRoute } from '@tanstack/react-router'
import { Login } from '~/components/Login'

export const Route = createFileRoute('/login')({
  component: LoginComp,
})

function LoginComp() {
  return <Login />
}
