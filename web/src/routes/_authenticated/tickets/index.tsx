import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { TicketList } from '@/features/ticket/components/ticket-list'

export const Route = createFileRoute('/_authenticated/tickets/')({
  component: TicketListPage,
})

function TicketListPage() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('My Tickets')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Link
          to="/tickets/new"
          className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t('New Ticket')}
        </Link>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <TicketList />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
