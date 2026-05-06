import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CommonLogsStats } from './common-logs-stats'
import { useUsageLogsContext } from './usage-logs-provider'

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

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <CommonLogsStats />
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
