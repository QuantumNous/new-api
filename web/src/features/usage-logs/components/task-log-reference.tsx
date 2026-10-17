/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'

export function TaskLogReference({ taskId }: { taskId: string }) {
  const { t } = useTranslation()

  return (
    <span className='inline-flex max-w-full min-w-0 items-center gap-1'>
      <span className='min-w-0 truncate font-mono' title={taskId}>
        {taskId}
      </span>
      <CopyButton value={taskId} className='size-6' iconClassName='size-3.5' />
      <Link
        to='/usage-logs/$section'
        params={{ section: 'task' }}
        search={{ filter: taskId, page: 1 }}
        aria-label={`${t('Task Logs')}: ${taskId}`}
        title={t('Task Logs')}
        className='text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-6 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none'
      >
        <ArrowUpRight className='size-3.5' aria-hidden='true' />
      </Link>
    </span>
  )
}
