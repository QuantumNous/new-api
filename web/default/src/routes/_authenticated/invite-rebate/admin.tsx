import { createFileRoute } from '@tanstack/react-router'

import { InviteRebateAdminPage } from '@/features/invite-rebate'

export const Route = createFileRoute('/_authenticated/invite-rebate/admin')({
  component: InviteRebateAdminPage,
})
