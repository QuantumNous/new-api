import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { AdminTicketDetail } from '@/features/ticket/components/admin-ticket-detail'

const ticketDetailSchema = z.object({
  id: z.coerce.number(),
})

export const Route = createFileRoute('/_authenticated/tickets/manage/$id')({
  component: AdminTicketDetailPage,
  parseParams: (params) => ticketDetailSchema.parse(params),
})

function AdminTicketDetailPage() {
  const { id } = Route.useParams()
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Ticket Detail')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <AdminTicketDetail id={id} />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
