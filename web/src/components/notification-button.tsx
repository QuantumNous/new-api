import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface NotificationButtonProps {
  unreadCount: number
  onClick: () => void
  className?: string
}

/**
 * Notification bell button with unread badge
 * Displays in the app header next to theme switch and profile dropdown
 */
export function NotificationButton({
  unreadCount,
  onClick,
  className,
}: NotificationButtonProps) {
  const { t } = useTranslation()
  return (
    <div className='relative'>
      <Button
        variant='ghost'
        size='icon'
        onClick={onClick}
        className={cn('h-9 w-9 rounded-full', className)}
        aria-label={t('Notifications')}
      >
        <Bell className='size-[1.2rem]' />
      </Button>

      {unreadCount > 0 && (
        <Badge
          variant='destructive'
          className='absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums'
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </div>
  )
}
