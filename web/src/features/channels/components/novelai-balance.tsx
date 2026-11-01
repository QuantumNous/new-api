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
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { updateChannelBalance } from '../api'
import { channelsQueryKeys, isMultiKeyChannel } from '../lib'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

export function NovelAIBalance(props: {
  channel: Channel
  detailed?: boolean
}) {
  const { t, i18n } = useTranslation()
  const { sensitiveVisible } = useChannels()
  const multiKey = isMultiKeyChannel(props.channel)
  const query = useQuery({
    queryKey: [...channelsQueryKeys.all, 'novelai-balance', props.channel.id],
    queryFn: async ({ signal }) => {
      const response = requireServerSuccess(
        await updateChannelBalance(props.channel.id, signal)
      )
      if (!response.novelai) {
        throw createServerError(response, t('Failed to query balance'))
      }
      return response.novelai
    },
    enabled: sensitiveVisible && !multiKey,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
    meta: { errorToast: false },
  })
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  if (!sensitiveVisible) {
    return <span>{'\u2022\u2022\u2022\u2022'}</span>
  }
  if (multiKey) {
    return (
      <span className='text-muted-foreground text-xs whitespace-normal'>
        {t('Multi-key channels do not support balance queries')}
      </span>
    )
  }

  const data = query.data
  const points = data?.trainingStepsLeft
  const usage = data?.usage
  const fixed = points?.fixedTrainingStepsLeft
  const purchased = points?.purchasedTrainingSteps
  let total: number | null = null
  if (fixed != null && purchased != null) total = fixed + purchased
  const percent = usage?.percent
  const number = (value: number | null | undefined) =>
    value == null ? t('Unknown') : formatNumber(value, locale)
  const allowanceText = percent == null ? t('Unknown') : `${number(percent)}%`
  let allowanceLabel = allowanceText
  if (usage?.isNegative === true) allowanceLabel += ` (${t('Exhausted')})`
  const nextPercent = usage?.timeUntilNextPercent
  let nextPercentLabel = t('Unknown')
  if (nextPercent === 0) nextPercentLabel = t('Refill paused')
  else if (nextPercent != null && data) {
    const seconds = Math.max(
      0,
      data.sampled_at + nextPercent - Math.floor(Date.now() / 1000)
    )
    nextPercentLabel = `${formatNumber(seconds, locale)}s`
  }

  const details = (
    <dl className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs'>
      <dt>{t('Subscription Anlas')}</dt>
      <dd className='text-right tabular-nums'>{number(fixed)}</dd>
      <dt>{t('Purchased Anlas')}</dt>
      <dd className='text-right tabular-nums'>{number(purchased)}</dd>
      <dt>{t('Purchased V5 allowance')}</dt>
      <dd className='text-right tabular-nums'>
        {number(usage?.purchasedPercent)}
        {usage?.purchasedPercent != null && '%'}
      </dd>
      <dt>{t('Next +1%')}</dt>
      <dd className='text-right tabular-nums'>{nextPercentLabel}</dd>
      {props.detailed && (
        <>
          <dt>{t('Status')}</dt>
          <dd className='text-right'>
            {data?.active ? t('Active') : t('Inactive')}
          </dd>
          <dt>{t('Expires at')}</dt>
          <dd className='text-right'>
            {formatTimestampToDate(data?.expiresAt ?? undefined)}
          </dd>
          <dt>{t('Last updated:')}</dt>
          <dd className='text-right'>
            {formatTimestampToDate(data?.sampled_at)}
          </dd>
        </>
      )}
    </dl>
  )

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex max-w-full min-w-0 flex-col gap-2',
          props.detailed && 'w-full'
        )}
        aria-busy={query.isFetching}
      >
        <div
          className='flex min-h-5 min-w-0 flex-row items-center gap-3'
          role='group'
          aria-label='NovelAI'
        >
          {query.isPending ? (
            <LoadingState inline size='sm' message={t('Loading...')} />
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      className='text-xs whitespace-nowrap tabular-nums'
                      tabIndex={0}
                      aria-label={`${number(total)} Anlas`}
                    />
                  }
                >
                  {number(total)}
                </TooltipTrigger>
                <TooltipContent>
                  <div className='flex flex-col gap-2'>
                    <span>Anlas</span>
                    {details}
                  </div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      className='text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums'
                      tabIndex={0}
                      aria-label={t('V5 allowance')}
                      aria-description={allowanceLabel}
                    />
                  }
                >
                  {allowanceText}
                </TooltipTrigger>
                <TooltipContent>
                  <div className='flex flex-col gap-1'>
                    <span>
                      {t('V5 allowance')}: {allowanceLabel}
                    </span>
                    <span>
                      {t('Next +1%')}: {nextPercentLabel}
                    </span>
                    {usage?.isNegative == null && <span>{t('Unknown')}</span>}
                    {!data?.active && <span>{t('Inactive')}</span>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {props.detailed && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    aria-label={t('Refresh NovelAI resources')}
                    disabled={query.isFetching}
                    onClick={() => {
                      void query.refetch()
                    }}
                  >
                    <HugeiconsIcon icon={RefreshIcon} aria-hidden='true' />
                  </Button>
                }
              />
              <TooltipContent>{t('Refresh NovelAI resources')}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {query.isError && (
          <span
            role='status'
            className='text-destructive text-xs whitespace-normal'
          >
            {data
              ? t('Refresh failed. Showing the last successful snapshot.')
              : t('Failed to query balance')}
          </span>
        )}
        {props.detailed && data && details}
      </div>
    </TooltipProvider>
  )
}
