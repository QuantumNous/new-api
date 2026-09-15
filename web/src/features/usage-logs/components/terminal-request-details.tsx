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
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
} from '@/components/drawer-layout'
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useTheme } from '@/context/theme-provider'
import {
  formatBillingCurrencyFromUSD,
  formatQuotaWithCurrency,
} from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { LOG_TYPE_ENUM } from '../constants'
import type { UsageLog } from '../data/schema'
import {
  getLogGroupRatio,
  getLogQuotaComparison,
  getLogChargedQuota,
} from '../lib/cost-comparison'
import { getTieredBillingSummary, parseLogOther } from '../lib/format'
import {
  getDynamicBillingDetails,
  getRecordedUnitPrices,
  getRequestErrorText,
  isFailedRequest,
} from '../lib/request-details'
import { DynamicBillingPopover } from './dynamic-billing-popover'

const moneyOptions = { digitsLarge: 6, digitsSmall: 6, abbreviate: false }

export function TerminalRequestDetails(props: { log: UsageLog }) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const log = props.log
  const other = parseLogOther(log.other)
  const failed = isFailedRequest(log)
  const error = getRequestErrorText(log)
  const billed = log.type === LOG_TYPE_ENUM.CONSUME
  const subscription = other?.billing_source === 'subscription'
  const comparison = billed ? getLogQuotaComparison(log.quota, other) : null
  const ratio = getLogGroupRatio(other)
  const prices = getRecordedUnitPrices(other)
  const dynamicSummary =
    prices.mode === 'dynamic'
      ? getTieredBillingSummary(other, { includeUnusedCache: true })
      : null
  const dynamicDetails =
    prices.mode === 'dynamic' ? getDynamicBillingDetails(other) : null
  const cacheRead = other?.cache_tokens ?? 0
  const cacheWrite = other?.cache_creation_tokens ?? 0
  const cacheWrite5m = other?.cache_creation_tokens_5m ?? 0
  const cacheWrite1h = other?.cache_creation_tokens_1h ?? 0
  const firstResponseMs = other?.frt
  const hasCacheUsage =
    cacheRead > 0 || cacheWrite > 0 || cacheWrite5m > 0 || cacheWrite1h > 0
  const hasDynamicCachePrice =
    dynamicSummary?.priceEntries.some((entry) =>
      ['cr', 'cc', 'cc1h'].includes(entry.key)
    ) ?? false
  const cacheIncludedInInput =
    prices.mode === 'dynamic' && hasCacheUsage && !hasDynamicCachePrice
  let charged = t('No charge')
  if (billed) {
    charged = subscription
      ? t('Subscription')
      : formatQuotaWithCurrency(
          getLogChargedQuota(log.quota, other),
          moneyOptions
        )
  }
  let discount = '—'
  if (
    billed &&
    !subscription &&
    prices.mode !== 'fee' &&
    prices.mode !== 'request' &&
    ratio !== null
  ) {
    discount = `${Number((Math.max(0, 1 - ratio) * 100).toFixed(2))}%`
  }
  const requestFacts = [
    { label: t('Model'), value: log.model_name || t('Unknown model') },
    {
      label: t('Time'),
      value: dayjs.unix(log.created_at).format('YYYY-MM-DD HH:mm:ss'),
    },
    { label: t('API key'), value: log.token_name || '—' },
    { label: t('Status'), value: failed ? t('Failed') : t('Worked') },
  ]
  const usageFacts = [
    { label: t('Input Tokens'), value: log.prompt_tokens.toLocaleString() },
    {
      label: t('Output Tokens'),
      value: log.completion_tokens.toLocaleString(),
    },
  ]
  if (Number.isFinite(cacheRead) && cacheRead > 0) {
    usageFacts.push({
      label: t('Cache Read'),
      value: cacheRead.toLocaleString(),
    })
  }
  if (
    Number.isFinite(cacheWrite) &&
    cacheWrite > 0 &&
    cacheWrite5m <= 0 &&
    cacheWrite1h <= 0
  ) {
    usageFacts.push({
      label: t('Cache Write'),
      value: cacheWrite.toLocaleString(),
    })
  }

  if (Number.isFinite(cacheWrite5m) && cacheWrite5m > 0) {
    usageFacts.push({
      label: t('Cache Write (5m)'),
      value: cacheWrite5m.toLocaleString(),
    })
  }
  if (Number.isFinite(cacheWrite1h) && cacheWrite1h > 0) {
    usageFacts.push({
      label: t('Cache Write (1h)'),
      value: cacheWrite1h.toLocaleString(),
    })
  }

  const unitPriceFacts =
    prices.mode === 'tokens'
      ? [
          { label: t('Base input price'), value: prices.input },
          { label: t('Base output price'), value: prices.output },
          { label: t('Base cache read price'), value: prices.cacheRead },
        ]
      : []
  if (prices.mode === 'tokens') {
    const hasTimedWrites =
      prices.cacheWrite5m !== null ||
      prices.cacheWrite1h !== null ||
      cacheWrite5m > 0 ||
      cacheWrite1h > 0
    if (!hasTimedWrites && (prices.cacheWrite !== null || cacheWrite > 0)) {
      unitPriceFacts.push({
        label: t('Base cache write price'),
        value: prices.cacheWrite,
      })
    }
    if (prices.cacheWrite5m !== null || cacheWrite5m > 0) {
      unitPriceFacts.push({
        label: t('Base cache write price (5m)'),
        value: prices.cacheWrite5m,
      })
    }
    if (prices.cacheWrite1h !== null || cacheWrite1h > 0) {
      unitPriceFacts.push({
        label: t('Base cache write price (1h)'),
        value: prices.cacheWrite1h,
      })
    }
  }

  return (
    <SheetContent
      side='right'
      overlayClassName='z-[65]'
      className={sideDrawerContentClassName(
        'ci-landing ci-theme ci-requestDetails z-[70] sm:max-w-[760px]'
      )}
      data-theme={resolvedTheme}
      showCloseButton={false}
    >
      <SheetHeader className='ci-requestDetailsHeader'>
        <SheetTitle>{t('Request details')}</SheetTitle>
        <SheetDescription>
          {log.model_name || t('Unknown model')}
        </SheetDescription>
        <SheetClose
          className='ci-appIconBtn ci-requestDetailsClose'
          aria-label={t('Close')}
        >
          <X size={16} aria-hidden='true' />
        </SheetClose>
      </SheetHeader>
      <div className={sideDrawerFormClassName('ci-requestDetailsBody')}>
        {failed && (
          <section className='ci-requestFailure' aria-label={t('Error')}>
            <h3>{t('Failed')}</h3>
            <p>
              {log.is_stream && other?.stream_status?.status === 'error'
                ? t('The response was interrupted before it finished.')
                : t(
                    'The request did not complete. Review the error message for details.'
                  )}
            </p>
            {error ? (
              <details>
                <summary>{t('Original error')}</summary>
                <pre>{error}</pre>
              </details>
            ) : (
              <p>{t('Failed, but no error text was saved.')}</p>
            )}
          </section>
        )}
        <section className='ci-requestDetailsSection'>
          <h3>{t('Request overview')}</h3>
          <dl className='ci-requestFacts'>
            {requestFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div
          className={cn(
            'ci-requestBilling',
            prices.mode === 'dynamic' && 'ci-requestBilling--dynamic'
          )}
        >
          <section
            className='ci-requestDetailsSection'
            aria-label={t('Request cost')}
          >
            <div className='ci-requestSectionHeading'>
              <h3>{t('Request cost')}</h3>
              {dynamicDetails ? (
                <DynamicBillingPopover
                  details={dynamicDetails}
                  charged={charged}
                />
              ) : null}
              {prices.mode === 'dynamic' ? (
                <span className='ci-requestBillingBadge'>
                  {t('Dynamic Pricing')}
                </span>
              ) : null}
              {dynamicSummary?.tier.label ? (
                <span className='ci-requestBillingTier'>
                  {t('Matched Tier')}: {dynamicSummary.tier.label}
                </span>
              ) : null}
            </div>
            <dl className='ci-requestFacts'>
              {prices.mode !== 'request' && (
                <div>
                  <dt>{t('Before-discount estimate')}</dt>
                  <dd>
                    {comparison
                      ? formatQuotaWithCurrency(
                          comparison.baseQuota,
                          moneyOptions
                        )
                      : '—'}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t('Charge')}</dt>
                <dd>{charged}</dd>
              </div>
              {comparison && comparison.savedQuota > 0 && (
                <div>
                  <dt>{t('Saved')}</dt>
                  <dd className='text-success'>
                    {formatQuotaWithCurrency(
                      comparison.savedQuota,
                      moneyOptions
                    )}
                  </dd>
                </div>
              )}
              {prices.mode !== 'request' && (
                <div>
                  <dt>{t('Discount rate')}</dt>
                  <dd>{discount}</dd>
                </div>
              )}
            </dl>
            {subscription && (
              <p className='ci-requestDetailsNote'>
                {t(
                  'This request used a subscription; cash savings are not comparable.'
                )}
              </p>
            )}
            {!subscription &&
              !comparison &&
              billed &&
              prices.mode !== 'request' &&
              prices.mode !== 'fee' && (
                <p className='ci-requestDetailsNote'>
                  {t(
                    'The recorded price is incomplete, so savings cannot be calculated.'
                  )}
                </p>
              )}
            {prices.mode === 'fee' && (
              <p className='ci-requestDetailsNote'>{t('Violation Fee')}</p>
            )}
            {prices.mode === 'dynamic' &&
              (!dynamicSummary || dynamicSummary.priceEntries.length === 0) && (
                <p className='ci-requestDetailsNote'>
                  {t(
                    'This request used dynamic pricing. The recorded charge includes its usage-based calculation.'
                  )}
                </p>
              )}
          </section>
          {prices.mode === 'tokens' && (
            <section
              className='ci-requestDetailsSection'
              aria-label={t('Base unit prices')}
            >
              <h3>{t('Base unit prices')}</h3>
              <dl className='ci-requestFacts'>
                {unitPriceFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>
                      {fact.value === null ? (
                        '—'
                      ) : (
                        <>
                          {formatBillingCurrencyFromUSD(
                            fact.value,
                            moneyOptions
                          )}{' '}
                          <span className='text-muted-foreground font-normal'>
                            /M
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className='ci-requestDetailsNote'>
                {t(
                  'Unit prices are per million tokens, before the request discount, using the rates recorded at the time.'
                )}
              </p>
            </section>
          )}
          {prices.mode === 'dynamic' &&
          dynamicSummary &&
          dynamicSummary.priceEntries.length > 0 ? (
            <section
              className='ci-requestDetailsSection'
              aria-label={t('Matched unit prices')}
            >
              <h3>{t('Matched unit prices')}</h3>
              <dl className='ci-requestPriceFacts'>
                {dynamicSummary.priceEntries.map((entry) => (
                  <div key={entry.key}>
                    <dt>{t(entry.shortLabel)}</dt>
                    <dd>
                      {formatBillingCurrencyFromUSD(entry.price, moneyOptions)}{' '}
                      <span className='text-muted-foreground font-normal'>
                        /M
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              {cacheIncludedInInput ? (
                <p className='ci-requestDetailsNote'>
                  {t('Cache usage is included in the input price.')}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
        <section className='ci-requestDetailsSection'>
          <h3>{t('Token Breakdown')}</h3>
          <dl className='ci-requestFacts'>
            {usageFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className='ci-requestDetailsSection'>
          <h3>{t('Timing')}</h3>
          <dl className='ci-requestFacts'>
            <div>
              <dt>{t('Time taken')}</dt>
              <dd>{log.use_time > 0 ? `${log.use_time.toFixed(1)}s` : '—'}</dd>
            </div>
            {log.is_stream &&
              typeof firstResponseMs === 'number' &&
              Number.isFinite(firstResponseMs) &&
              firstResponseMs > 0 && (
                <div>
                  <dt>{t('First response time')}</dt>
                  <dd>{`${(firstResponseMs / 1000).toFixed(3)}s`}</dd>
                </div>
              )}
          </dl>
        </section>
        <section className='ci-requestDetailsSection'>
          <h3>{t('Request ID')}</h3>
          <div className='ci-requestId'>
            <code>{log.request_id || '—'}</code>
            {log.request_id && (
              <CopyButton
                value={log.request_id}
                aria-label={t('Copy request ID')}
                className='ci-appIconBtn'
              />
            )}
          </div>
        </section>
      </div>
    </SheetContent>
  )
}
