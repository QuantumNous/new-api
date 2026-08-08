import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { TicketCreateForm } from '@/features/ticket/components/ticket-create-form'

export const Route = createFileRoute('/_authenticated/tickets/new')({
  component: TicketNewPage,
})

function TicketNewPage() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Create New Ticket')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <TicketCreateForm />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
