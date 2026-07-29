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
import {
  Activity,
  BarChart3,
  Copy,
  KeyRound,
  Mail,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '@/features/dashboard/hooks/use-count-up'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { MOTION_TRANSITION } from '@/lib/motion'
import { getRoleLabel } from '@/lib/roles'
import { cn } from '@/lib/utils'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'
import { ProfileSurface } from './profile-surface'

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

function AnimatedStatValue(props: {
  value: number
  format: (n: number) => string
  delay?: number
}) {
  const animated = useCountUp(props.value, {
    duration: 0.9,
    delay: props.delay ?? 0,
  })
  return (
    <span className='font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl'>
      {props.format(Math.round(animated))}
    </span>
  )
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()

  if (loading) {
    return (
      <ProfileSurface className='p-0'>
        <div className='p-5 sm:p-7'>
          <div className='flex flex-col gap-5 sm:flex-row sm:items-center'>
            <Skeleton className='size-20 rounded-2xl sm:size-24' />
            <div className='min-w-0 flex-1 space-y-3'>
              <Skeleton className='h-8 w-48' />
              <Skeleton className='h-4 w-72 max-w-full' />
              <div className='flex gap-2'>
                <Skeleton className='h-8 w-24 rounded-lg' />
                <Skeleton className='h-8 w-28 rounded-lg' />
              </div>
            </div>
          </div>
        </div>
        <div className='border-border/40 grid grid-cols-3 border-t'>
          {['a', 'b', 'c'].map((k) => (
            <div key={k} className='space-y-2 p-4 sm:p-5'>
              <Skeleton className='h-3 w-16' />
              <Skeleton className='h-7 w-24' />
            </div>
          ))}
        </div>
      </ProfileSurface>
    )
  }

  if (!profile) return null

  const displayName = getDisplayName(profile)
  const avatarName = profile.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = getUserAvatarStyle(avatarName)
  const roleLabel = getRoleLabel(profile.role)

  const stats: {
    key: string
    label: string
    raw: number
    format: (n: number) => string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
    delay: number
  }[] = [
    {
      key: 'balance',
      label: t('Current Balance'),
      raw: profile.quota,
      format: formatQuota,
      description: t('Remaining quota'),
      icon: WalletCards,
      tone: 'success',
      delay: 0,
    },
    {
      key: 'usage',
      label: t('Total Usage'),
      raw: profile.used_quota,
      format: formatQuota,
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
      delay: 0.05,
    },
    {
      key: 'requests',
      label: t('API Requests'),
      raw: profile.request_count,
      format: (n) => formatCompactNumber(n),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
      delay: 0.1,
    },
  ]

  const handleCopyId = async () => {
    const ok = await copyToClipboard(String(profile.id))
    if (ok) toast.success(t('Copied'))
  }

  return (
    <ProfileSurface className='p-0'>
      {/* Ambient gradient mesh */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 overflow-hidden'
      >
        <div className='from-primary/12 via-chart-4/8 absolute -top-24 -right-16 size-72 rounded-full bg-gradient-to-br to-transparent blur-3xl' />
        <div className='from-info/10 absolute -bottom-28 -left-20 size-64 rounded-full bg-gradient-to-tr to-transparent blur-3xl' />
        <div className='via-border/40 absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent' />
      </div>

      <div className='relative p-5 sm:p-7'>
        <motion.div
          initial={shouldReduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOTION_TRANSITION.default}
          className='flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6'
        >
          <div className='relative shrink-0 self-start'>
            <div
              aria-hidden
              className='from-primary/40 to-chart-4/30 absolute -inset-1 rounded-[1.15rem] bg-gradient-to-br opacity-80 blur-[2px]'
            />
            <Avatar className='ring-background relative size-20 rounded-2xl text-lg ring-4 sm:size-24 sm:text-xl'>
              <AvatarFallback
                className='rounded-2xl font-semibold text-white'
                style={avatarFallbackStyle}
              >
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className='min-w-0 flex-1 space-y-3'>
            <div className='space-y-1.5'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <h1 className='text-foreground truncate text-2xl font-semibold tracking-tight sm:text-3xl'>
                  {displayName}
                </h1>
                <StatusBadge
                  label={roleLabel}
                  variant='neutral'
                  copyable={false}
                />
              </div>

              <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
                <span className='font-medium'>@{profile.username}</span>
                {profile.email ? (
                  <span className='inline-flex max-w-full items-center gap-1 truncate'>
                    <Mail className='size-3.5 shrink-0 opacity-70' />
                    <span className='truncate'>{profile.email}</span>
                  </span>
                ) : null}
                {profile.group ? (
                  <span className='inline-flex items-center gap-1'>
                    <Users className='size-3.5 shrink-0 opacity-70' />
                    {profile.group}
                  </span>
                ) : null}
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                className='h-8 gap-1.5'
                onClick={() => void handleCopyId()}
              >
                <Copy className='size-3.5' />
                {t('User ID')} {profile.id}
              </Button>
              <Button
                size='sm'
                className='h-8 gap-1.5'
                render={<Link to='/wallet' />}
              >
                <Wallet className='size-3.5' />
                {t('Top up')}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                className='h-8 gap-1.5'
                render={<Link to='/keys' />}
              >
                <KeyRound className='size-3.5' />
                {t('API Keys')}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className='border-border/40 relative grid grid-cols-1 border-t sm:grid-cols-3'>
        {stats.map((item, index) => (
          <motion.div
            key={item.key}
            initial={shouldReduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...MOTION_TRANSITION.default, delay: 0.08 + index * 0.05 }}
            className={cn(
              'group/stat hover:bg-muted/25 min-w-0 px-4 py-4 transition-colors sm:px-5 sm:py-5',
              index > 0 && 'border-border/40 border-t sm:border-t-0 sm:border-l'
            )}
          >
            <div className='flex items-center gap-2'>
              <IconBadge
                tone={item.tone}
                size='stat'
                className='transition-transform duration-200 group-hover/stat:scale-105'
              >
                <item.icon />
              </IconBadge>
              <span className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase'>
                {item.label}
              </span>
            </div>
            <div className='text-foreground mt-2'>
              <AnimatedStatValue
                value={item.raw}
                format={item.format}
                delay={item.delay}
              />
            </div>
            <p className='text-muted-foreground/70 mt-1 hidden text-xs sm:block'>
              {item.description}
            </p>
          </motion.div>
        ))}
      </div>
    </ProfileSurface>
  )
}
