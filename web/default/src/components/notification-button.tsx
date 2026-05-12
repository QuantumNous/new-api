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
        className={cn('h-9 w-9', className)}
        aria-label={t('Notifications')}
      >
        <Bell className='size-[1.2rem]' />
      </Button>

      {unreadCount > 0 && (
        <Badge
          variant='destructive'
          className='absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums'
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </div>
  )
}
