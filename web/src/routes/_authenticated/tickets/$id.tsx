import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { TicketDetail } from '@/features/ticket/components/ticket-detail'

const ticketDetailSchema = z.object({
  id: z.coerce.number(),
})

export const Route = createFileRoute('/_authenticated/tickets/$id')({
  component: TicketDetailPage,
  parseParams: (params) => ticketDetailSchema.parse(params),
})

function TicketDetailPage() {
  const { id } = Route.useParams()
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Ticket Detail')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <TicketDetail id={id} />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
