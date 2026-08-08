import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getAllTickets } from '../api'
import { TicketStatusBadge } from './ticket-status-badge'
import type { Ticket, TicketStatus, TicketCategory } from '../types'
import { TICKET_STATUS_OPTIONS, TICKET_CATEGORY_OPTIONS } from '../types'
import { EmptyState } from '@/components/empty-state'

export function AdminTicketList() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [keyword, setKeyword] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets', page, statusFilter, categoryFilter, keyword],
    queryFn: () =>
      getAllTickets({
        page,
        page_size: 10,
        status: statusFilter,
        category: categoryFilter,
        keyword,
      }),
  })

  const tickets = data?.data?.tickets ?? []
  const total = data?.data?.total ?? 0
  const totalPages = Math.ceil(total / 10)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
          placeholder={t('Search tickets...')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{t('All Statuses')}</option>
          {TICKET_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{t('All Categories')}</option>
          {TICKET_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState title={t('No tickets found')} description={t('No tickets match your criteria')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('Title')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('Category')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('Status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('Priority')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('Created')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tickets.map((ticket: Ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{ticket.id}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {ticket.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{t(ticket.category)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <TicketStatusBadge status={ticket.status as TicketStatus} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{t(ticket.priority)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {new Date(ticket.created_at * 1000).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      to="/tickets/manage/$id"
                      params={{ id: String(ticket.id) }}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      {t('View')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            {t('Previous')}
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            {t('Next')}
          </button>
        </div>
      )}
    </div>
  )
}
