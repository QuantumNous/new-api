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
import { ChevronRight, Wallet } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getSelf } from '@/lib/api'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatQuota } from '@/lib/format'
import { MOTION_TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Sidebar account strip: identity + live balance, designed as part of the
 * sidebar chrome rather than a separate bordered card.
 */
export function SidebarAccountFooter() {
  const { t } = useTranslation()
  const { state } = useSidebar()
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const shouldReduce = useReducedMotion()
  const collapsed = state === 'collapsed'

  useEffect(() => {
    let cancelled = false
    void getSelf()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return
        setUser(res.data as typeof user)
      })
      .catch(() => {
        /* keep existing session user */
      })
    return () => {
      cancelled = true
    }
  }, [setUser])

  if (!user) return null

  const display =
    user.display_name?.trim() ||
    user.email?.trim() ||
    user.username ||
    t('Account')
  const balance = formatQuota(user.quota ?? 0)
  const avatarName = user.username || display
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarStyle = getUserAvatarStyle(avatarName)

  return (
    <SidebarFooter className='border-sidebar-border/50 gap-0 border-t p-2'>
      <SidebarMenu>
        <SidebarMenuItem>
          {collapsed ? (
            <div className='flex flex-col items-center gap-1.5 py-1'>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      to='/profile'
                      className='ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none'
                      aria-label={display}
                    />
                  }
                >
                  <Avatar size='sm' className='size-8 rounded-lg'>
                    <AvatarFallback
                      className='rounded-lg text-[11px] font-semibold text-white'
                      style={avatarStyle}
                    >
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side='right'>
                  <p className='font-medium'>{display}</p>
                  <p className='text-muted-foreground text-xs'>
                    {t('Account balance')}: {balance}
                  </p>
                </TooltipContent>
              </Tooltip>
              <SidebarMenuButton
                tooltip={`${t('Top up')} · ${balance}`}
                render={<Link to='/wallet' />}
                className='size-8'
              >
                <Wallet className='size-4' />
                <span>{t('Top up')}</span>
              </SidebarMenuButton>
            </div>
          ) : (
            <motion.div
              initial={shouldReduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={MOTION_TRANSITION.fast}
              className='w-full space-y-2'
            >
              <Link
                to='/profile'
                className={cn(
                  'group/account hover:bg-sidebar-accent/60 flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5',
                  'ring-sidebar-ring transition-colors focus-visible:ring-2 focus-visible:outline-none'
                )}
              >
                <Avatar size='sm' className='size-8 shrink-0 rounded-lg'>
                  <AvatarFallback
                    className='rounded-lg text-[11px] font-semibold text-white'
                    style={avatarStyle}
                  >
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1'>
                  <p
                    className='text-sidebar-foreground truncate text-xs font-medium'
                    title={display}
                  >
                    {display}
                  </p>
                  <p className='text-muted-foreground truncate text-[11px] tabular-nums'>
                    ID {user.id}
                  </p>
                </div>
                <ChevronRight className='text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover/account:opacity-100' />
              </Link>

              <div className='flex items-center gap-2 px-1.5'>
                <div className='min-w-0 flex-1'>
                  <p className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                    {t('Account balance')}
                  </p>
                  <p className='text-sidebar-foreground truncate text-sm font-semibold tabular-nums'>
                    {balance}
                  </p>
                </div>
                <Link
                  to='/wallet'
                  className={cn(
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-medium',
                    'ring-sidebar-ring transition-colors focus-visible:ring-2 focus-visible:outline-none'
                  )}
                >
                  <Wallet className='size-3.5' />
                  {t('Top up')}
                </Link>
              </div>
            </motion.div>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
