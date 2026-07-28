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
import { Activity, BarChart3, Gauge, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import {
  getUserInitials,
  getDisplayName,
  type ProfileSubscriptionSummary,
} from '../lib'
import type { UserProfile } from '../types'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
  subscription?: ProfileSubscriptionSummary | null
}

export function ProfileHeader(props: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='bg-card overflow-hidden rounded-lg border'>
        <div className='p-4 sm:p-5'>
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-stretch'>
            <div className='flex items-start gap-3 sm:gap-4'>
              <Skeleton className='h-12 w-12 rounded-xl sm:h-16 sm:w-16 sm:rounded-2xl' />
              <div className='min-w-0 flex-1 space-y-3'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <Skeleton className='h-8 w-48 max-w-full' />
                  <Skeleton className='h-5 w-16' />
                </div>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-40 max-w-full' />
                </div>
                <Skeleton className='h-8 w-44 rounded-full' />
                <div className='space-y-2'>
                  <Skeleton className='h-4 w-full max-w-md' />
                  <Skeleton className='h-4 w-full max-w-lg' />
                </div>
              </div>
            </div>
            <div className='rounded-lg border p-4'>
              <div className='flex items-center justify-between gap-3'>
                <Skeleton className='h-5 w-24' />
                <Skeleton className='h-5 w-16 rounded-full' />
              </div>
              <Skeleton className='mt-4 h-8 w-32' />
              <div className='mt-4 grid grid-cols-2 gap-3'>
                <Skeleton className='h-14 w-full' />
                <Skeleton className='h-14 w-full' />
              </div>
              <Skeleton className='mt-4 h-2 w-full rounded-full' />
            </div>
          </div>
        </div>
        <div className='border-t'>
          <div className='divide-border/60 grid grid-cols-2 divide-x'>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className='px-4 py-3.5 sm:px-5 sm:py-4'>
                <Skeleton className='h-3.5 w-20' />
                <Skeleton className='mt-2 h-7 w-28' />
                <Skeleton className='mt-1.5 h-3.5 w-24' />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!props.profile) return null

  const displayName = getDisplayName(props.profile)
  const initials = getUserInitials(props.profile)
  const roleLabel = getRoleLabel(props.profile.role)
  const subscription = props.subscription ?? null
  const stats = [
    {
      label: t('Total Usage'),
      value: formatQuota(props.profile.used_quota),
      description: t('Total consumed quota'),
      icon: BarChart3,
    },
    {
      label: t('API Requests'),
      value: formatCompactNumber(props.profile.request_count),
      description: t('Total requests made'),
      icon: Activity,
    },
  ]
  const planTotalValue =
    subscription?.unlimited === true
      ? t('Unlimited')
      : formatQuota(subscription?.totalQuota ?? 0)
  const planRemainingValue =
    subscription?.unlimited === true
      ? t('Unlimited')
      : formatQuota(subscription?.remainingQuota ?? 0)
  const planProgressValue =
    subscription?.unlimited === true ? 0 : (subscription?.usagePercent ?? 0)

  return (
    <div className='bg-card overflow-hidden rounded-lg border'>
      <div className='p-3 sm:p-5'>
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-stretch'>
          <div className='flex min-w-0 items-start gap-3 text-left sm:gap-4'>
            <Avatar className='ring-background h-12 w-12 rounded-xl text-sm ring-2 sm:h-16 sm:w-16 sm:rounded-2xl sm:text-lg sm:ring-4'>
              <AvatarFallback className='bg-primary/10 text-primary rounded-xl sm:rounded-2xl'>
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className='min-w-0 flex-1 space-y-3'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>
                  {displayName}
                </h1>
                <StatusBadge
                  label={roleLabel}
                  variant='neutral'
                  copyable={false}
                />
                <StatusBadge
                  label={`${t('User ID')} ${props.profile.id}`}
                  variant='info'
                  copyText={String(props.profile.id)}
                />
              </div>

              <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:gap-x-4 sm:text-sm'>
                <span className='truncate'>@{props.profile.username}</span>
                {props.profile.email && (
                  <>
                    <span>•</span>
                    <span className='truncate'>{props.profile.email}</span>
                  </>
                )}
                {props.profile.group && (
                  <>
                    <span>•</span>
                    <span className='truncate'>{props.profile.group}</span>
                  </>
                )}
              </div>

              <div className='space-y-2'>
                <div
                  data-slot='profile-balance'
                  className='border-border/70 bg-muted/50 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm'
                >
                  <WalletCards
                    className='text-muted-foreground size-4 shrink-0'
                    aria-hidden='true'
                  />
                  <span className='text-muted-foreground shrink-0'>
                    {t('Available balance')}
                  </span>
                  <span className='text-foreground min-w-0 font-mono font-semibold tabular-nums'>
                    {formatQuota(props.profile.quota)}
                  </span>
                </div>
                <div
                  data-slot='profile-balance-guidance'
                  className='text-muted-foreground max-w-2xl space-y-1 text-xs leading-relaxed sm:text-sm'
                >
                  <p>{t('Balance can be used to purchase plans directly.')}</p>
                  <p>
                    {t(
                      'After plan quota is exhausted, balance is used automatically for API usage billing.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {subscription && (
            <section
              data-slot='profile-plan-summary'
              aria-label={t('Current Plan')}
              className='border-primary/30 bg-primary/5 min-w-0 rounded-lg border p-4 shadow-sm'
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <div className='text-primary text-xs font-medium tracking-wider uppercase'>
                    {t('Current Plan')}
                  </div>
                  <div className='text-foreground mt-1 truncate text-2xl font-semibold tracking-tight'>
                    {subscription.planTitle}
                  </div>
                </div>
                <StatusBadge label={t('Active')} variant='success' />
              </div>

              {subscription.remainingDays !== null && (
                <div className='text-muted-foreground mt-3 text-sm'>
                  {t('Remaining days')}{' '}
                  <span className='text-foreground font-mono font-semibold tabular-nums'>
                    {subscription.remainingDays}
                  </span>
                </div>
              )}

              <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
                <div className='bg-background/70 rounded-md border p-3'>
                  <div className='text-muted-foreground text-xs font-medium'>
                    {t('Monthly model quota')}
                  </div>
                  <div className='text-foreground mt-1 font-mono text-lg font-semibold tabular-nums'>
                    {planTotalValue}
                  </div>
                </div>
                <div className='bg-background/70 rounded-md border p-3'>
                  <div className='text-muted-foreground text-xs font-medium'>
                    {t('Remaining')}
                  </div>
                  <div className='text-foreground mt-1 font-mono text-lg font-semibold tabular-nums'>
                    {planRemainingValue}
                  </div>
                </div>
              </div>

              <div className='mt-4 space-y-2'>
                <div className='flex items-center gap-2 text-xs font-medium'>
                  <Gauge
                    className='text-primary size-4 shrink-0'
                    aria-hidden='true'
                  />
                  <span>{t('Progress')}</span>
                </div>
                <Progress
                  value={planProgressValue}
                  aria-label={t('Progress')}
                  getAriaValueText={
                    subscription.unlimited ? () => t('Unlimited') : undefined
                  }
                  className='h-2'
                />
              </div>
            </section>
          )}
        </div>
      </div>
      <div className='border-t'>
        <div className='divide-border/60 grid grid-cols-2 divide-x'>
          {stats.map((item) => (
            <div key={item.label} className='min-w-0 px-3 py-3 sm:px-5 sm:py-4'>
              <div className='flex items-center gap-2'>
                <item.icon
                  className='text-muted-foreground/60 size-3.5 shrink-0'
                  aria-hidden='true'
                />
                <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                  {item.label}
                </div>
              </div>

              <div className='text-foreground mt-1.5 truncate font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                {item.value}
              </div>
              <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
