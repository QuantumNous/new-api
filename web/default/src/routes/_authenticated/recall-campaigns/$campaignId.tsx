import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { CampaignDetail } from '@/features/recall-campaigns/components/campaign-detail'

export const Route = createFileRoute(
  '/_authenticated/recall-campaigns/$campaignId'
)({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN)
      throw redirect({ to: '/403' })
  },
  component: RecallCampaignDetailRoute,
})

function RecallCampaignDetailRoute() {
  const { campaignId } = Route.useParams()
  return <CampaignDetail campaignId={Number(campaignId)} />
}
