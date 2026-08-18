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
import { Activity, BarChart3, Gift, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatNumber,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import {
  getUserInitials,
  getDisplayName,
  type ProfileSubscriptionSummary,
  type ProfileUsageWindowSummary,
} from '../lib'
import type { UserProfile } from '../types'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
  subscription: ProfileSubscriptionSummary | null
}

interface ProfileUsageWindowMeterProps {
  label: string
  summary: ProfileUsageWindowSummary
  slot:
    | 'profile-plan-window-5h'
    | 'profile-plan-window-7d'
    | 'profile-plan-window-media'
  media?: boolean
}

function formatUsageWindowValue(
  summary: ProfileUsageWindowSummary,
  media: boolean
): string {
  if (media) return String(Math.max(0, Math.round(summary.totalQuota)))
  return formatQuota(summary.totalQuota)
}

function formatUsageWindowUsedValue(
  summary: ProfileUsageWindowSummary,
  media: boolean
): string {
  if (media) return String(Math.max(0, Math.round(summary.usedQuota)))
  return formatQuota(summary.usedQuota)
}

function formatUsageWindowRemainingValue(
  summary: ProfileUsageWindowSummary,
  media: boolean
): string {
  if (media) return String(Math.max(0, Math.round(summary.remainingQuota)))
  return formatQuota(summary.remainingQuota)
}

function ProfileUsageWindowMeter(props: ProfileUsageWindowMeterProps) {
  const { t } = useTranslation()
  const isMedia = props.media === true

  if (props.summary.unlimited) {
    return (
      <div data-slot={props.slot} className='min-w-0 space-y-1.5'>
        <div className='flex min-h-5 items-center justify-between gap-3 text-xs'>
          <span className='font-medium'>{props.label}</span>
          <span className='text-muted-foreground tabular-nums'>
            {t('Unlimited')}
          </span>
        </div>
        <Progress
          value={0}
          aria-label={props.label}
          getAriaValueText={() => t('Unlimited')}
          className='h-1.5'
        />
        <div className='text-muted-foreground min-h-4 text-xs'>
          {t('No usage limit')}
        </div>
      </div>
    )
  }

  if (props.summary.notIncluded) {
    return (
      <div data-slot={props.slot} className='min-w-0 space-y-1.5'>
        <div className='flex min-h-5 items-center justify-between gap-3 text-xs'>
          <span className='font-medium'>{props.label}</span>
          <span className='text-muted-foreground tabular-nums'>
            {t('Not included')}
          </span>
        </div>
        <Progress
          value={0}
          aria-label={props.label}
          getAriaValueText={() => t('Not included')}
          className='h-1.5'
        />
        <div className='text-muted-foreground min-h-4 text-xs'>
          {t('{{remaining}} remaining', { remaining: '0' })}
        </div>
      </div>
    )
  }

  const usedValue = formatUsageWindowUsedValue(props.summary, isMedia)
  const totalValue = formatUsageWindowValue(props.summary, isMedia)
  const remainingValue = formatUsageWindowRemainingValue(props.summary, isMedia)

  return (
    <div data-slot={props.slot} className='min-w-0 space-y-1.5'>
      <div className='flex min-h-5 items-center justify-between gap-3 text-xs'>
        <span className='font-medium'>{props.label}</span>
        <span className='text-muted-foreground tabular-nums'>
          {t('{{used}} / {{total}} used', {
            used: usedValue,
            total: totalValue,
          })}
        </span>
      </div>
      <Progress
        value={props.summary.usagePercent}
        aria-label={props.label}
        className='h-1.5'
      />
      <div className='text-muted-foreground min-h-4 text-xs'>
        {props.summary.resetAt > 0
          ? t('{{remaining}} remaining, resets {{date}}', {
              remaining: remainingValue,
              date: formatTimestampToDate(props.summary.resetAt),
            })
          : t('{{remaining}} remaining', {
              remaining: remainingValue,
            })}
      </div>
    </div>
  )
}

export function ProfileHeader(props: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='bg-card w-full overflow-hidden rounded-lg border'>
        <div className='p-3 sm:p-5'>
          <div
            data-slot='profile-header-top-row'
            className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start'
          >
            <div
              data-slot='profile-identity'
              className='flex items-start gap-3 sm:gap-4'
            >
              <Skeleton className='h-12 w-12 rounded-xl' />
              <div className='min-w-0 flex-1 space-y-3'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <Skeleton className='h-8 w-48 max-w-full' />
                  <Skeleton className='h-5 w-16' />
                </div>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-40 max-w-full' />
                </div>
              </div>
            </div>

            <aside
              data-slot='profile-balance-column'
              className='min-w-0 space-y-2 lg:w-[390px] lg:justify-self-end'
            >
              <div className='flex flex-wrap items-center gap-3 lg:justify-end'>
                <Skeleton className='h-9 w-44 rounded-lg' />
                <Skeleton className='h-9 w-24 rounded-lg' />
              </div>
              <div className='space-y-2 lg:flex lg:flex-col lg:items-end'>
                <Skeleton className='h-4 w-full max-w-sm' />
                <Skeleton className='h-4 w-full max-w-md' />
              </div>
            </aside>
          </div>

          <section
            data-slot='profile-plan-summary'
            className='mt-5 border-t pt-4 sm:pt-5'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0 space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-32' />
                <Skeleton className='h-4 w-40' />
              </div>
              <Skeleton className='h-5 w-16 rounded-full' />
            </div>
            <div
              data-slot='profile-plan-short-window-row'
              className='mt-4 grid gap-4 lg:grid-cols-3'
            >
              {[
                'profile-plan-window-5h',
                'profile-plan-window-7d',
                'profile-plan-window-media',
              ].map((slot) => (
                <div
                  key={slot}
                  data-slot={slot}
                  className='min-w-0 space-y-1.5'
                >
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-5 w-32' />
                  <Skeleton className='h-1.5 w-full rounded-full' />
                  <Skeleton className='h-4 w-28' />
                </div>
              ))}
            </div>
            <div
              data-slot='profile-plan-quota-row'
              className='mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:items-end'
            >
              <div>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='mt-2 h-6 w-28' />
              </div>
              <div className='flex flex-col items-end'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='mt-2 h-6 w-24' />
              </div>
            </div>
            <Skeleton className='mt-3 h-1.5 w-full rounded-full' />
          </section>

          <div
            data-slot='profile-stats'
            className='mt-3 grid grid-cols-2 gap-2 sm:gap-3'
          >
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className='rounded-lg border px-3 py-3 sm:px-4'>
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
  const subscription = props.subscription
  const stats = [
    {
      label: t('Total Usage'),
      value: formatQuota(props.profile.used_quota),
      icon: BarChart3,
    },
    {
      label: t('API Requests'),
      value: formatNumber(props.profile.request_count),
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
    <div className='bg-card w-full overflow-hidden rounded-lg border'>
      <div className='p-3 sm:p-5'>
        <div
          data-slot='profile-header-top-row'
          className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start'
        >
          <div
            data-slot='profile-identity'
            className='flex min-w-0 items-start gap-3 text-left sm:gap-4'
          >
            <Avatar className='ring-background h-12 w-12 rounded-xl text-sm ring-2'>
              <AvatarFallback className='bg-primary/10 text-primary rounded-xl'>
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className='min-w-0 flex-1 space-y-3'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <h1 className='truncate text-lg font-semibold tracking-tight'>
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
              </div>
            </div>
          </div>

          <aside
            data-slot='profile-balance-column'
            className='min-w-0 space-y-2 lg:w-[390px] lg:justify-self-end lg:text-right'
          >
            <div
              data-slot='profile-balance-actions'
              className='flex flex-wrap items-center gap-3 lg:justify-end'
            >
              <div
                data-slot='profile-balance'
                className='border-border bg-background inline-flex h-9 max-w-full items-center gap-2 rounded-lg border px-3 text-sm shadow-xs'
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
              <Button
                variant='outline'
                size='sm'
                className='h-9 rounded-lg px-3 shadow-xs'
                render={<a href='/redeem' />}
              >
                <Gift className='size-4' aria-hidden='true' />
                {t('Redeem Code')}
              </Button>
            </div>
            <div
              data-slot='profile-balance-guidance'
              className='text-muted-foreground space-y-1 text-xs leading-relaxed'
            >
              <p>{t('Balance can be used to purchase plans directly.')}</p>
              <p>
                {t(
                  'After plan quota is exhausted, balance is used automatically for API usage billing.'
                )}
              </p>
            </div>
          </aside>
        </div>

        {subscription && (
          <section
            data-slot='profile-plan-summary'
            aria-label={t('Current Plan')}
            className='mt-5 border-t pt-4 sm:pt-5'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Current Plan')}
                </div>
                <div className='text-foreground mt-1 truncate text-xl font-semibold tracking-tight'>
                  {subscription.planTitle}
                </div>
                {subscription.remainingDays !== null && (
                  <div className='text-muted-foreground mt-2 text-sm'>
                    {t('Remaining days')}{' '}
                    <span className='text-foreground font-mono font-semibold tabular-nums'>
                      {subscription.remainingDays}
                    </span>
                  </div>
                )}
              </div>
              <StatusBadge
                label={t('Active')}
                variant='success'
                copyable={false}
              />
            </div>

            <div
              data-slot='profile-plan-short-window-row'
              className='mt-4 grid gap-4 lg:grid-cols-3'
            >
              <ProfileUsageWindowMeter
                slot='profile-plan-window-5h'
                label={t('5-hour limit')}
                summary={subscription.window5h}
              />
              <ProfileUsageWindowMeter
                slot='profile-plan-window-7d'
                label={t('7-day limit')}
                summary={subscription.window7d}
              />
              <ProfileUsageWindowMeter
                slot='profile-plan-window-media'
                label={t('Media generation credits')}
                summary={subscription.mediaCredits}
                media
              />
            </div>

            <div
              data-slot='profile-plan-quota-row'
              className='mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:items-end'
            >
              <div className='min-w-0'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Monthly model quota')}
                </div>
                <div className='text-foreground mt-1 truncate font-mono text-lg font-semibold tabular-nums'>
                  {planTotalValue}
                </div>
              </div>
              <div className='min-w-0 text-right'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Remaining')}
                </div>
                <div className='text-foreground mt-1 truncate font-mono text-lg font-semibold tabular-nums'>
                  {planRemainingValue}
                </div>
              </div>
            </div>

            <div className='mt-3'>
              <Progress
                value={planProgressValue}
                aria-label={t('Progress')}
                getAriaValueText={
                  subscription.unlimited ? () => t('Unlimited') : undefined
                }
                className='h-1.5'
              />
            </div>
          </section>
        )}

        <div
          data-slot='profile-stats'
          className='mt-3 grid grid-cols-2 gap-2 sm:gap-3'
        >
          {stats.map((item) => (
            <div
              key={item.label}
              className='min-w-0 rounded-lg border px-3 py-3 sm:px-4'
            >
              <div className='flex items-center gap-2'>
                <item.icon
                  className='text-muted-foreground/60 size-3.5 shrink-0'
                  aria-hidden='true'
                />
                <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                  {item.label}
                </div>
              </div>

              <div className='text-foreground mt-1.5 truncate font-mono text-base font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-lg'>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
