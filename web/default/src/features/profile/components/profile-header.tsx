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
import { useTranslation } from 'react-i18next'

import { CopyableStatusBadge, StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

export function ProfileHeader({ profile, loading }: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardContent className='p-4 sm:p-5'>
          <div className='flex items-center gap-3 sm:gap-4'>
            <Skeleton className='size-12 rounded-xl sm:size-14' />
            <div className='space-y-2'>
              <Skeleton className='h-6 w-48' />
              <Skeleton className='h-4 w-64' />
            </div>
          </div>
        </CardContent>
        <div className='border-t'>
          <div className='divide-border/60 grid grid-cols-3 divide-x'>
            {['balance', 'usage', 'requests'].map((key) => (
              <div key={key} className='px-4 py-3 sm:px-5 sm:py-4'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='mt-2 h-7 w-28' />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!profile) return null

  const displayName = getDisplayName(profile)
  const avatarName = profile.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = getUserAvatarStyle(avatarName)
  const roleLabel = getRoleLabel(profile.role)
  const stats = [
    {
      label: t('Current Balance'),
      value: formatQuota(profile.quota),
    },
    {
      label: t('Total Usage'),
      value: formatQuota(profile.used_quota),
    },
    {
      label: t('API Requests'),
      value: formatCompactNumber(profile.request_count),
    },
  ]

  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <CardContent className='p-4 sm:p-5'>
        <div className='flex items-center gap-3 sm:gap-4'>
          <Avatar className='size-12 rounded-xl text-base sm:size-14 sm:text-lg'>
            <AvatarFallback
              className='rounded-xl font-semibold text-white'
              style={avatarFallbackStyle}
            >
              {avatarFallback}
            </AvatarFallback>
          </Avatar>

          <div className='min-w-0 flex-1 space-y-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1'>
              <h1 className='truncate text-xl font-semibold tracking-tight'>
                {displayName}
              </h1>
              <StatusBadge className='shrink-0'>{roleLabel}</StatusBadge>
            </div>

            <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm'>
              <span className='truncate'>@{profile.username}</span>
              <span aria-hidden='true'>·</span>
              <CopyableStatusBadge value={String(profile.id)}>
                ID {profile.id}
              </CopyableStatusBadge>
              {profile.email && (
                <>
                  <span aria-hidden='true'>·</span>
                  <span className='truncate'>{profile.email}</span>
                </>
              )}
              {profile.group && (
                <>
                  <span aria-hidden='true'>·</span>
                  <span className='truncate'>{profile.group}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <div className='border-t'>
        <div className='divide-border/60 grid grid-cols-3 divide-x'>
          {stats.map((item) => (
            <div key={item.label} className='min-w-0 px-4 py-3 sm:px-5 sm:py-4'>
              <div className='text-muted-foreground truncate text-sm'>
                {item.label}
              </div>
              <div className='text-foreground mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl'>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
