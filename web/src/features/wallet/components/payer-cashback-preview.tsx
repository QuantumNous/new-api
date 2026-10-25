import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatCashbackCents } from '@/features/cashback/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import {
  usePayerCashbackPreview,
  type PayerCashbackPreviewState,
  type PayerCashbackSelection,
} from '../hooks/use-payer-cashback-preview'
import { getCashbackQuotaPerFaceUnit } from '../lib/cashback'

type Props = PayerCashbackSelection

export function PayerCashbackPreview(props: Props) {
  const state = usePayerCashbackPreview(props)
  return <PayerCashbackPreviewView {...props} state={state} />
}

type ViewProps = PayerCashbackSelection & {
  state: PayerCashbackPreviewState
}

export function PayerCashbackPreviewView(props: ViewProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { config, meta } = getCurrencyDisplay()
  const { query, userId, valid, selectionReady } = props.state
  // A raw quota unit can be much smaller than a cent (notably for Creem
  // products); never round a positive amount up to a fake minimum.
  const quotaDigits = Math.min(
    20,
    Math.max(4, Math.ceil(Math.log10(config.quotaPerUnit)) + 2)
  )
  const formatRewardQuota = (quota: number) =>
    formatQuotaWithCurrency(quota, {
      locale,
      digitsSmall: quotaDigits,
      abbreviate: false,
    })

  let message: string
  let capNote: string | null = null
  if (!valid || !userId) {
    message = t('Select a valid amount to preview cashback.')
  } else if (!props.productId && props.amount === 0) {
    message = t('Select an amount to preview cashback.')
  } else if (!selectionReady || query.isFetching) {
    message = t('Checking your cashback estimate…')
  } else if (
    !props.productId &&
    query.isError &&
    isAxiosError(query.error) &&
    query.error.response?.status === 400
  ) {
    message = t('Select a valid amount to preview cashback.')
  } else if (query.isError || !query.data) {
    message = t('Cashback estimate is temporarily unavailable.')
  } else {
    switch (query.data.status) {
      case 'estimated': {
        const amountOptions = {
          locale,
          minimumFractionDigits: 2,
          digitsSmall: quotaDigits,
          abbreviate: false,
        }
        message = t('Estimated cashback: {{amount}}', {
          amount: formatQuotaWithCurrency(
            query.data.reward_quota,
            amountOptions
          ),
        })
        const capReasons = (query.data.cap_reason ?? '').split(',')
        const calculated = query.data.calculated_quota ?? 0
        if (calculated > query.data.reward_quota) {
          const values = {
            calculated: formatQuotaWithCurrency(calculated, amountOptions),
          }
          if (capReasons.includes('single_cap')) {
            capNote = t(
              'The rule gives {{calculated}}, reduced by the single cashback limit.',
              values
            )
          } else if (capReasons.includes('daily_cap')) {
            capNote = t(
              'The rule gives {{calculated}}, reduced by your remaining 24-hour cashback allowance.',
              values
            )
          }
        }
        break
      }
      case 'no_campaign':
        message = t('No active cashback campaign for this top-up.')
        break
      case 'limit_reached':
        message = t('Your cashback campaign limit has been reached.')
        break
      case 'not_first_top_up':
        message = t(
          'This campaign rewards first top-ups only, and your account has topped up before.'
        )
        break
      case 'cap_exhausted':
        message = t(
          'Your cashback allowance for the past 24 hours is exhausted.'
        )
        break
      case 'below_minimum':
        message = t('This amount is below the cashback threshold.')
        break
      case 'rounds_to_zero':
        message = t('This tier reward rounds down to zero wallet quota.')
        break
      case 'not_applicable':
        message = t('Tiered cashback is not available for this top-up method.')
        break
      case 'ineligible':
        message = t('Cashback is not available for this account right now.')
        break
      case 'select_amount':
        message = t('Select an amount to preview cashback.')
        break
      default:
        message = t('Cashback is not active right now.')
    }
  }

  const preview =
    selectionReady && !query.isFetching && !query.isError && valid
      ? query.data
      : undefined
  let fixedRule: string | null = null
  if (preview?.strategy === 'per_hundred' && preview.status !== 'no_campaign') {
    if (props.productId) {
      // Creem products are measured in their own quota, not the top-up amount.
      fixedRule = t('Campaign rule: {{reward}} for every 100 face units', {
        reward: formatNumber(preview.fixed_per_hundred, locale),
      })
    } else {
      // The fixed amount is expressed in the same unit as the top-up amount,
      // so render both sides in the configured display currency.
      const quotaPerFaceUnit = getCashbackQuotaPerFaceUnit(
        config.quotaPerUnit,
        meta.kind === 'tokens'
      )
      fixedRule = t(
        'Campaign rule: {{reward}} back for every {{threshold}} topped up',
        {
          threshold: formatRewardQuota(100 * quotaPerFaceUnit),
          reward: formatRewardQuota(
            (preview.fixed_per_hundred ?? 0) * quotaPerFaceUnit
          ),
        }
      )
    }
  }
  return (
    <Alert className='min-w-0' aria-live='polite'>
      <AlertTitle>{t('Top-up cashback preview')}</AlertTitle>
      <AlertDescription className='space-y-1 break-words'>
        {preview?.strategy === 'rate' && preview.status !== 'no_campaign' && (
          <p>
            {t('Campaign rule: {{rate}}% of the selected face amount', {
              rate: formatNumber((preview.rate_bps ?? 0) / 100, locale),
            })}
          </p>
        )}
        {fixedRule && <p>{fixedRule}</p>}
        {preview?.strategy === 'tiered' && preview.tiers && (
          <div>
            <p>{t('Tiered cashback (CNY per order)')}</p>
            <ul className='list-inside list-disc'>
              {preview.tiers.map((tier) => (
                <li key={tier.threshold_cents}>
                  {t('Top up {{threshold}} or more: {{reward}} back', {
                    threshold: formatCashbackCents(
                      tier.threshold_cents,
                      locale
                    ),
                    reward: formatCashbackCents(tier.reward_cents, locale),
                  })}
                </li>
              ))}
            </ul>
            {preview.matched_tier && (
              <p>
                {t('Highest tier reached: {{threshold}}', {
                  threshold: formatCashbackCents(
                    preview.matched_tier.threshold_cents,
                    locale
                  ),
                })}
              </p>
            )}
          </div>
        )}
        <p>{message}</p>
        {capNote && <p>{capNote}</p>}
        <p>
          {t(
            'Estimate only. Eligibility and final cashback are determined when payment succeeds.'
          )}
        </p>
      </AlertDescription>
    </Alert>
  )
}
