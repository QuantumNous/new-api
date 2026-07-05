import { createFileRoute, redirect } from '@tanstack/react-router'
import { Commission } from '@/features/commission'
import { useSystemConfigStore } from '@/stores/system-config-store'

export const Route = createFileRoute('/_authenticated/commission/')({
  beforeLoad: () => {
    const { commissionEnabled } = useSystemConfigStore.getState().config
    if (!commissionEnabled) throw redirect({ to: '/wallet' })
  },
  component: Commission,
})
