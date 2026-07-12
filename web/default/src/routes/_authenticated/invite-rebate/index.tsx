import { createFileRoute } from '@tanstack/react-router'

import { InviteRebatePage } from '@/features/invite-rebate'

export const Route = createFileRoute('/_authenticated/invite-rebate/')({
  component: InviteRebatePage,
})
