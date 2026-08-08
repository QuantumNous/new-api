import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getMyTickets } from '../api'
import { TicketStatusBadge } from './ticket-status-badge'
import type { Ticket } from '../types'
import { EmptyState } from '@/components/empty-state'

export function TicketList() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => getMyTickets({ page: 1, page_size: 20 }),
  })

  const tickets = data?.data?.tickets ?? []
  const total = data?.data?.total ?? 0

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    )
  }

  if (tickets.length === 0) {
    return <EmptyState title={t('No tickets yet')} description={t('Create a ticket to get help')} />
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{t('Total')}: {total}</p>
      {tickets.map((ticket: Ticket) => (
        <Link
          key={ticket.id}
          to="/tickets/$id"
          params={{ id: String(ticket.id) }}
          className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TicketStatusBadge status={ticket.status as any} />
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {ticket.title}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                {ticket.content}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-gray-400">
              <div>{new Date(ticket.created_at * 1000).toLocaleDateString()}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
