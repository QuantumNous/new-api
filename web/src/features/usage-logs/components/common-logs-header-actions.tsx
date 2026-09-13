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
import { Download, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { CommonLogsStats } from './common-logs-stats'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

/**
 * Page-header actions for the Common Logs view: live usage stats plus a
 * toggle for masking sensitive values (token names, usernames, group names,
 * and the quota figure shown in stats). Both controls live in the page
 * header so the toolbar below stays focused on filter inputs and form
 * actions only.
 */
export function CommonLogsHeaderActions() {
  const { t } = useTranslation()
  const { sensitiveVisible, setSensitiveVisible } = useUsageLogsContext()
  const { isAdminView } = useLogsViewScope()

  const handleExport = () => {
    const searchParams = new URLSearchParams(window.location.search)
    const exportPath = isAdminView
      ? '/api/log/export'
      : '/api/log/self/export'
    window.open(`${exportPath}?${searchParams.toString()}`, '_blank')
    toast.success(t('Log data is being exported to CSV file'))
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <CommonLogsStats />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              onClick={handleExport}
              aria-label={t('Export')}
              className='text-muted-foreground hover:text-foreground size-7'
            />
          }
        >
          <Download />
        </TooltipTrigger>
        <TooltipContent>
          {t('Export to CSV')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setSensitiveVisible(!sensitiveVisible)}
              aria-label={sensitiveVisible ? t('Hide') : t('Show')}
              className='text-muted-foreground hover:text-foreground size-7'
            />
          }
        >
          {sensitiveVisible ? <Eye /> : <EyeOff />}
        </TooltipTrigger>
        <TooltipContent>
          {sensitiveVisible ? t('Hide') : t('Show')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
