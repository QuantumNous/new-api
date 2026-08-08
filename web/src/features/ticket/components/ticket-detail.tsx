import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { getTicket, addTicketMessage, closeTicket, reopenTicket } from '../api'
import { TicketStatusBadge } from './ticket-status-badge'
import type { Ticket, TicketMessage } from '../types'

export function TicketDetail({ id }: { id: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [newMessage, setNewMessage] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id),
  })

  const ticket = data?.data

  const messageMutation = useMutation({
    mutationFn: () => addTicketMessage(id, newMessage.trim()),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Reply sent'))
        setNewMessage('')
        queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      }
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => closeTicket(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Ticket closed'))
        queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      }
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenTicket(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Ticket reopened'))
        queryClient.invalidateQueries({ queryKey: ['ticket', id] })
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
    return (
      <div className="py-12 text-center text-gray-500">
        {t('Ticket not found')}
      </div>
    )
  }

  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved'

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
            #{ticket.id} · {new Date(ticket.created_at * 1000).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!isClosed ? (
            <button
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('Close')}
            </button>
          ) : (
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('Reopen')}
            </button>
          )}
        </div>
      </div>

      {/* Original content */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {ticket.content}
        </p>
      </div>

      {/* Messages */}
      {ticket.messages && ticket.messages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('Replies')} ({ticket.messages.length})
          </h3>
          {ticket.messages.map((msg: TicketMessage) => (
            <div
              key={msg.id}
              className={`rounded-lg border p-4 ${
                msg.user_id === ticket.user_id
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                <span className="font-medium">
                  {msg.user_id === ticket.user_id ? t('You') : t('Support')}
                </span>
                <span>{new Date(msg.created_at * 1000).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {msg.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {!isClosed && (
        <div className="space-y-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder={t('Type your reply...')}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => messageMutation.mutate()}
              disabled={messageMutation.isPending || !newMessage.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {messageMutation.isPending ? t('Sending...') : t('Send Reply')}
            </button>
            <button
              onClick={() => navigate({ to: '/tickets' })}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('Back to list')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
