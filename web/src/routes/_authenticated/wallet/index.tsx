import { createFileRoute } from '@tanstack/react-router'
import { Wallet } from '@/features/wallet'

export const Route = createFileRoute('/_authenticated/wallet/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Wallet />
}
