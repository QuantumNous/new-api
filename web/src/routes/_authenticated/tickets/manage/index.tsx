import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { AdminTicketList } from '@/features/ticket/components/admin-ticket-list'

export const Route = createFileRoute('/_authenticated/tickets/manage/')({
  component: AdminTicketListPage,
})

function AdminTicketListPage() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Ticket Management')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <AdminTicketList />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
