import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  getTicketAdmin,
  addTicketMessageAdmin,
  updateTicketStatus,
} from '../api'
import { TicketStatusBadge } from './ticket-status-badge'
import type { Ticket, TicketMessage, TicketStatus } from '../types'
import { TICKET_STATUS_OPTIONS } from '../types'

export function AdminTicketDetail({ id }: { id: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [newMessage, setNewMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ticket', id],
    queryFn: () => getTicketAdmin(id),
  })

  const ticket = data?.data

  const messageMutation = useMutation({
    mutationFn: () => addTicketMessageAdmin(id, newMessage.trim(), isInternal),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Reply sent'))
        setNewMessage('')
        queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] })
      }
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateTicketStatus(id, status),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Status updated'))
        queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] })
      }
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    )
  }

  if (!ticket) {
    return <div className="py-12 text-center text-gray-500">{t('Ticket not found')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TicketStatusBadge status={ticket.status as any} />
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
              {ticket.title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            #{ticket.id} · {t('User')}: {ticket.user_name || `#${ticket.user_id}`} ·{' '}
            {new Date(ticket.created_at * 1000).toLocaleString()}
          </p>
        </div>

        {/* Status controls */}
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={ticket.status}
            onChange={(e) => statusMutation.mutate(e.target.value)}
            disabled={statusMutation.isPending}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {TICKET_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Original content */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {ticket.content}
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('Messages')} ({ticket.messages?.length ?? 0})
        </h3>
        {ticket.messages?.map((msg: TicketMessage) => (
          <div
            key={msg.id}
            className={`rounded-lg border p-4 ${
              msg.is_internal
                ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
                : msg.user_id === ticket.user_id
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
              <span className="font-medium">{msg.user_name || `#${msg.user_id}`}</span>
              {msg.is_internal && (
                <span className="rounded bg-orange-200 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-800 dark:text-orange-300">
                  {t('Internal')}
                </span>
              )}
              <span>{new Date(msg.created_at * 1000).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {msg.content}
            </p>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder={t('Type your reply...')}
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t('Internal note (user cannot see)')}
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => messageMutation.mutate()}
            disabled={messageMutation.isPending || !newMessage.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {messageMutation.isPending ? t('Sending...') : t('Send Reply')}
          </button>
          <button
            onClick={() => navigate({ to: '/tickets/manage' })}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('Back to list')}
          </button>
        </div>
      </div>
    </div>
  )
}
