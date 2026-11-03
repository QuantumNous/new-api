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
import { MessageSquareOff, Scissors, Unplug, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatLogQuota } from '@/lib/format'

import {
  getStreamCut,
  hasEmptyResponseCharge,
  hasToolSurcharge,
} from '../lib/format'
import type { LogOtherData } from '../types'

interface LogCostDisplayProps {
  quota: number
  other: LogOtherData | null
}

function splitQuotaDisplay(value: string): { prefix: string; amount: string } {
  const match = value.match(/^([^0-9+\-.,\s]+)(.+)$/)
  if (!match) return { prefix: '', amount: value }
  return { prefix: match[1], amount: match[2] }
}

function ToolSurchargeMarker() {
  const { t } = useTranslation()
  const label = t('Includes tool-call surcharge')

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant='warning'
            className='h-5 min-w-5 cursor-help gap-0 rounded-full px-1'
            role='img'
            aria-label={label}
            tabIndex={0}
            data-tool-surcharge-indicator='true'
          >
            <Wrench strokeWidth={2} aria-hidden='true' />
            <span
              className='text-[9px] leading-none font-bold'
              aria-hidden='true'
            >
              +
            </span>
          </Badge>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EmptyResponseMarker() {
  const { t } = useTranslation()
  const label = t('Charged for empty response')
  // WCAG 2.5.3 Label in Name: the accessible name must contain the visible
  // text, so the short "Empty reply" chip leads the full sentence.
  const accessibleName = `${t('Empty reply')} — ${label}`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant='warning'
            className='h-5 min-w-5 cursor-help gap-1 rounded-full px-1.5'
            role='img'
            aria-label={accessibleName}
            tabIndex={0}
            data-empty-response-indicator='true'
          >
            <MessageSquareOff
              className='size-3'
              strokeWidth={2}
              aria-hidden='true'
            />
            <span className='text-[9px] leading-none font-bold'>
              {t('Empty reply')}
            </span>
          </Badge>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function StreamCutMarker(props: {
  cut: 'upstream' | 'client'
  discounted: boolean
  emptyWaived: boolean
}) {
  const { t } = useTranslation()
  const upstream = props.cut === 'upstream'
  let label = t('Client disconnected mid-stream; charged at full price')
  if (props.emptyWaived) {
    label = t('Reduced by multiplier')
  } else if (upstream) {
    label = props.discounted
      ? t('Upstream stream cut — output charged at truncated multiplier')
      : t('Upstream Stream Cut')
  }
  // WCAG 2.5.3: the accessible name contains the visible chip text.
  const chip = upstream ? t('Upstream cut') : t('Client cut')
  const accessibleName = `${chip} — ${label}`
  const Icon = upstream ? Unplug : Scissors

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant={upstream ? 'warning' : 'secondary'}
            className='h-5 min-w-5 cursor-help gap-1 rounded-full px-1.5'
            role='img'
            aria-label={accessibleName}
            tabIndex={0}
            data-stream-cut-indicator={props.cut}
          >
            <Icon className='size-3' strokeWidth={2} aria-hidden='true' />
            <span className='text-[9px] leading-none font-bold'>{chip}</span>
          </Badge>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function QuotaBadge(props: { quota: number }) {
  const quotaDisplay = splitQuotaDisplay(formatLogQuota(props.quota))

  return (
    <span className='border-border/80 bg-muted/60 inline-flex h-6 w-fit items-center rounded-md border px-2 [font-family:var(--font-body)] text-sm leading-none font-semibold tabular-nums'>
      {quotaDisplay.prefix ? (
        <span className='mr-1'>{quotaDisplay.prefix}</span>
      ) : null}
      <span>{quotaDisplay.amount}</span>
    </span>
  )
}

function SubscriptionBadge(props: { quota: number; walletOverflow?: number }) {
  const { t } = useTranslation()
  // walletOverflow arrives already display-converted from the backend
  // (wallet_quota_deducted_display); props.quota is likewise the request's
  // display-converted total, so the two stay in the same unit for subtraction.
  const wallet = props.walletOverflow ?? 0
  const hasWallet = wallet > 0
  // When the charge splits between the subscription and the wallet (subscription
  // remaining quota exceeded), the subscription absorbs the remainder and the
  // wallet covers the overflow — the two tooltip figures must sum to the total
  // rather than both report it, and neither must mix display/raw units.
  const subPortion = Math.max(0, props.quota - wallet)
  const quotaDisplay = splitQuotaDisplay(formatLogQuota(props.quota))

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role='img'
            aria-label={
              hasWallet
                ? `${t('Subscription + Wallet')}: ${formatLogQuota(props.quota)}`
                : `${t('Subscription')}: ${formatLogQuota(props.quota)}`
            }
            className={`inline-flex h-6 w-fit items-center rounded-md border px-2 [font-family:var(--font-body)] text-sm leading-none font-semibold tabular-nums ${
              hasWallet
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-green-500 bg-green-50 text-green-700'
            }`}
          >
            {quotaDisplay.prefix ? (
              <span className='mr-1'>{quotaDisplay.prefix}</span>
            ) : null}
            <span>{quotaDisplay.amount}</span>
          </span>
        }
      />
      <TooltipContent>
        <span>
          {t('Deducted by subscription')}: {formatLogQuota(subPortion)}
          {hasWallet && (
            <>
              {' · '}
              {t('Wallet overflow charge')}: {formatLogQuota(wallet)}
            </>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

export function LogCostDisplay(props: LogCostDisplayProps) {
  const isSubscription = props.other?.billing_source === 'subscription'
  const showToolSurcharge = hasToolSurcharge(props.other)
  const showEmptyResponse = hasEmptyResponseCharge(props.other)
  const streamCut = getStreamCut(props.other)
  const streamCutDiscounted = props.other?.truncated_response_multiplier != null
  const streamCutEmptyWaived = props.other?.empty_response_waived === true

  if (
    !isSubscription &&
    !showToolSurcharge &&
    !showEmptyResponse &&
    !streamCut
  ) {
    return (
      <div className='flex flex-col gap-0.5'>
        <QuotaBadge quota={props.quota} />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className='inline-flex items-center gap-1'>
        {isSubscription ? (
          <SubscriptionBadge
            quota={props.quota}
            // Prefer the display-converted overflow so the badge never formats a
            // raw relay quota as currency; fall back to the raw value if absent.
            walletOverflow={
              props.other?.wallet_quota_deducted_display ??
              props.other?.wallet_quota_deducted
            }
          />
        ) : (
          <QuotaBadge quota={props.quota} />
        )}
        {showToolSurcharge ? <ToolSurchargeMarker /> : null}
        {showEmptyResponse ? <EmptyResponseMarker /> : null}
        {streamCut ? (
          <StreamCutMarker
            cut={streamCut}
            discounted={streamCutDiscounted}
            emptyWaived={streamCutEmptyWaived}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
