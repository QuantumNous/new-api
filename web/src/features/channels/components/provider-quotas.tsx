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
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Cloud } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getProviderQuotas } from '../api'
import type { AgentPlanQuota } from '../types'

function remainingPercent(
  window: NonNullable<AgentPlanQuota['windows']>[number]
): number {
  if (window.used_percent !== undefined) return 100 - window.used_percent
  return Math.max(0, 1 - (window.used ?? 0) / (window.quota ?? 1)) * 100
}

function AgentPlanRow(props: { plan: AgentPlanQuota; defaultOpen: boolean }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const plan = props.plan
  const windows = plan.windows ?? []
  const tightest = windows.reduce<(typeof windows)[number] | undefined>(
    (lowest, window) =>
      !lowest || remainingPercent(window) < remainingPercent(lowest)
        ? window
        : lowest,
    undefined
  )
  const remaining = tightest ? remainingPercent(tightest) : 0
  const now = Date.now() / 1000
  const stale =
    plan.status !== 'ok' ||
    !plan.last_success_at ||
    now - plan.last_success_at > 150
  const expiresIn = plan.expires_at ? plan.expires_at - now : undefined
  const status = {
    pending: t('Waiting for first sync'),
    credentials_missing: t('Missing query credentials'),
    access_denied: t('Quota query denied'),
    rate_limited: t('Quota query rate limited'),
    unavailable: t('Quota sync failed'),
    no_quota: t('No quota reported'),
    ok: t('Quota data is stale'),
  }[plan.status]
  const periodLabels = {
    five_hour: t('5-hour window'),
    daily: t('Daily window'),
    weekly: t('Weekly window'),
    monthly: t('Monthly window'),
  }
  const product =
    plan.product === 'coding-plan' ? t('Coding Plan') : 'Agent Plan'
  let title = plan.name || product
  if (!plan.name && plan.seat_id) title = t('Team seat')
  const channelCount = new Set(
    plan.keys.flatMap((key) => key.channels.map((channel) => channel.id))
  ).size

  return (
    <Collapsible defaultOpen={props.defaultOpen} className='border-t'>
      <CollapsibleTrigger className='group/plan hover:bg-muted/30 aria-expanded:bg-muted/30 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-4 py-4 text-start md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.2fr)_minmax(0,.85fr)_minmax(0,.85fr)_auto] md:items-center'>
        <span className='col-span-2 grid min-w-0 gap-1 md:col-span-1'>
          <span className='font-medium wrap-anywhere'>{title}</span>
          {title !== product && (
            <span className='text-muted-foreground text-xs'>{product}</span>
          )}
          <span className='text-muted-foreground text-xs'>
            {t('Upstream keys: {{keys}} · Channels: {{channels}}', {
              keys: formatNumber(plan.keys.length, locale),
              channels: formatNumber(channelCount, locale),
            })}
          </span>
        </span>
        <span className='col-span-3 grid min-w-0 gap-1 md:col-span-1'>
          {tightest && !stale ? (
            <>
              <span className='font-medium tabular-nums'>
                {t('{{percent}}% remaining', {
                  percent: formatNumber(remaining, locale),
                })}
              </span>
              <Progress
                value={remaining}
                aria-label={t('Remaining quota')}
                className={
                  remaining <= 20
                    ? '[&_[data-slot=progress-indicator]]:bg-amber-500'
                    : undefined
                }
              />
              <span className='text-muted-foreground text-xs'>
                {periodLabels[tightest.period]}
              </span>
            </>
          ) : (
            <Badge
              variant={plan.status === 'pending' ? 'outline' : 'secondary'}
              className='h-auto max-w-full justify-start whitespace-normal'
            >
              {status}
            </Badge>
          )}
        </span>
        <span className='grid gap-1'>
          <span className='text-muted-foreground text-xs'>
            {t('Quota reset')}
          </span>
          <span className='text-sm tabular-nums'>
            {formatTimestampToDate(!stale ? tightest?.reset_at : undefined)}
          </span>
        </span>
        <span className='grid gap-1'>
          <span className='text-muted-foreground text-xs'>
            {t('Subscription expires')}
          </span>
          <span className='text-sm tabular-nums'>
            {formatTimestampToDate(plan.expires_at)}
          </span>
          {expiresIn !== undefined && expiresIn <= 7 * 24 * 60 * 60 && (
            <Badge variant={expiresIn <= 0 ? 'destructive' : 'outline'}>
              {expiresIn <= 0 ? t('Expired') : t('Expires within 7 days')}
            </Badge>
          )}
        </span>
        <ChevronRight
          aria-hidden='true'
          className='text-muted-foreground col-start-3 row-start-1 size-4 group-aria-expanded/plan:rotate-90 md:col-start-5'
        />
      </CollapsibleTrigger>

      <CollapsibleContent className='grid gap-5 border-t px-4 py-4 md:grid-cols-2'>
        <section className='min-w-0 space-y-3'>
          <div className='flex flex-wrap items-baseline justify-between gap-2'>
            <h3 className='font-medium'>
              {stale && windows.length
                ? t('Last known quota')
                : t('Remaining quota')}
            </h3>
            {plan.last_success_at && (
              <span className='text-muted-foreground text-xs tabular-nums'>
                {t('Last sync: {{time}}', {
                  time: formatTimestampToDate(plan.last_success_at),
                })}
              </span>
            )}
          </div>
          {windows.length > 0 ? (
            <dl className='space-y-2'>
              {windows.map((window) => (
                <div
                  key={window.period}
                  className='flex flex-wrap items-baseline justify-between gap-1 border-b pb-2 last:border-b-0'
                >
                  <dt className='text-muted-foreground'>
                    {periodLabels[window.period]}
                  </dt>
                  <dd className='grid text-end tabular-nums'>
                    <span>
                      {window.used_percent !== undefined
                        ? t('{{percent}}% remaining', {
                            percent: formatNumber(
                              remainingPercent(window),
                              locale
                            ),
                          })
                        : `${formatNumber(Math.max(0, (window.quota ?? 0) - (window.used ?? 0)), locale)} / ${formatNumber(window.quota, locale)} AFP`}
                    </span>
                    {window.reset_at && (
                      <span className='text-muted-foreground text-xs'>
                        {formatTimestampToDate(window.reset_at)}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className='text-muted-foreground'>{status}</p>
          )}
        </section>
        <section className='min-w-0 space-y-3'>
          <div className='flex flex-wrap items-baseline justify-between gap-2'>
            <h3 className='font-medium'>{t('Upstream keys and channels')}</h3>
            {plan.keys.length > 0 && (
              <span className='text-muted-foreground text-xs'>
                {t('Recorded today · UTC+8')}
              </span>
            )}
          </div>
          {plan.seat_id && (
            <p className='text-muted-foreground text-xs wrap-anywhere'>
              {t('Seat ID: {{id}}', { id: plan.seat_id })}
            </p>
          )}
          {plan.keys.length === 0 && (
            <p className='text-muted-foreground'>
              {t('No upstream keys are linked')}
            </p>
          )}
          {plan.unmatched_channels ? (
            <p className='text-muted-foreground'>
              {t('Some configured channels do not match this plan')}
            </p>
          ) : null}
          {plan.keys.map((key) => (
            <div key={key.id}>
              <div className='bg-muted/60 flex flex-wrap items-baseline justify-between gap-2 rounded-md px-3 py-2 font-medium'>
                <span>{t('Upstream key {{key}}', { key: key.label })}</span>
                <span className='tabular-nums'>
                  {key.today_tokens === undefined
                    ? t('Usage unavailable')
                    : t('Total: {{tokens}} tokens', {
                        tokens: formatNumber(key.today_tokens, locale),
                      })}
                </span>
              </div>
              <ul className='border-border ms-4 space-y-2 border-s ps-4 pt-2'>
                {key.channels.map((channel) => (
                  <li
                    key={channel.id}
                    className='flex flex-wrap items-baseline justify-between gap-2'
                  >
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      <span className='text-foreground me-2 text-sm wrap-anywhere'>
                        {channel.name}
                      </span>
                      #{channel.id}
                    </span>
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {channel.today_tokens === undefined
                        ? '—'
                        : t('{{tokens}} tokens', {
                            tokens: formatNumber(channel.today_tokens, locale),
                          })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {plan.keys.some((key) => key.today_tokens !== undefined) && (
            <p className='text-muted-foreground text-xs'>
              {t(
                'Counts include requests recorded after key usage tracking started.'
              )}
            </p>
          )}
        </section>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ProviderQuotas() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const query = useQuery({
    queryKey: ['channel-agent-plan-quotas'],
    queryFn: async () => requireServerSuccess(await getProviderQuotas()).data,
    refetchInterval: 60_000,
  })

  if (query.isPending) {
    return <Skeleton className='h-48 w-full' />
  }
  if (query.isError) {
    return (
      <ErrorState
        description={getServerErrorMessage(query.error)}
        onRetry={() => query.refetch()}
      />
    )
  }
  if (!query.data?.length) {
    return (
      <EmptyState
        icon={Cloud}
        title={t('No monitored subscriptions configured')}
        description={t(
          'Set VOLCENGINE_AGENT_PLAN_MONITOR or VOLCENGINE_CODING_PLAN_MONITOR on the server.'
        )}
      />
    )
  }
  return (
    <Card className='gap-0 py-0'>
      <header className='flex items-center gap-3 px-4 py-4'>
        <span className='bg-primary/10 text-primary rounded-lg p-2.5'>
          <Cloud aria-hidden='true' className='size-5' />
        </span>
        <div className='space-y-1'>
          <h2 className='text-base font-medium'>{t('Volcengine Ark')}</h2>
          <p className='text-muted-foreground text-xs'>
            {t('Quota pools: {{total}} · Syncs every minute', {
              total: formatNumber(query.data.length, locale),
            })}
          </p>
        </div>
      </header>
      {query.data.map((plan, index) => (
        <AgentPlanRow key={plan.id} plan={plan} defaultOpen={index === 0} />
      ))}
    </Card>
  )
}
