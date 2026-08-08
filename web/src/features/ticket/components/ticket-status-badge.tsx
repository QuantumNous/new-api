import type { TicketStatus } from '../types'

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: '待处理', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  in_progress: { label: '处理中', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  waiting_for_user: { label: '等待回复', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  resolved: { label: '已解决', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  closed: { label: '已关闭', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status] || statusConfig.open
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
