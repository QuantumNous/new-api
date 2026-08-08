import { useTranslation } from 'react-i18next'
import { formatRecallMinorAmount, recallFixedCurrencies } from '../helpers'
import type { RecallCampaignPreview } from '../types'

const knownLifecycleOutcomeCodes = new Set<string>([
  'pending',
  'leased',
  'enrolled',
  'skipped',
  'processed',
  'suppressed',
  'failed',
  'invalid_email',
  'no_account_email',
  'lease_recovered',
  'malformed_event_data',
  'missing_user',
  'invalid_email_sequence',
  'missing_stage_one',
  'lifecycle_recipient_inconsistent',
  'lifecycle_message_inconsistent',
  'lifecycle_enrollment_failed',
  'quota_recovered',
  'quota_cycle_changed',
  'engagement_opted_out',
  'registration_used',
  'order_state_changed',
  'smtp_uncertain',
  'activity_smtp_not_configured',
  'activity_smtp_send_failed',
])

const knownLifecycleEventTypes = new Set<string>([
  'user_registered',
  'registration_unused',
  'quota_low',
  'quota_exhausted_unpaid',
  'payment_failed',
  'payment_pending',
  'payment_succeeded',
])

type Translate = (key: string) => string

function formatTimestamp(value: number): string {
  return value > 0 ? new Date(value * 1000).toLocaleString() : '-'
}

export function formatRecallLifecycleOutcomeCode(
  code: string,
  t: Translate
): string {
  if (!knownLifecycleOutcomeCodes.has(code)) {
    return t('Unknown lifecycle outcome')
  }
  return t(code)
}

export function formatRecallLifecycleEventType(
  code: string,
  t: Translate
): string {
  if (!knownLifecycleEventTypes.has(code)) return t('Unknown lifecycle event')
  return t(code)
}

export function formatRecallMessageState(state: string, t: Translate): string {
  if (state === 'accepted') return t('SMTP accepted')
  return t(state)
}

export function CampaignPreviewDialogContent(props: {
  data?: RecallCampaignPreview
  isError?: boolean
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  const { data } = props

  return (
    <>
      {props.isLoading ? <p>{t('Loading')}</p> : null}
      {props.isError ? (
        <p className='text-destructive'>
          {t('Failed to load campaign preview')}
        </p>
      ) : null}
      {data?.lifecycle ? (
        <div className='space-y-4'>
          <div className='rounded-lg border p-3'>
            <h3 className='font-medium'>{t('Lifecycle event boundary')}</h3>
            <dl className='mt-2 grid gap-2 text-sm md:grid-cols-2'>
              <div>
                <dt className='text-muted-foreground'>
                  {t('Collection start')}
                </dt>
                <dd>{formatTimestamp(data.lifecycle.collection_start_at)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>
                  {t('Processing start')}
                </dt>
                <dd>{formatTimestamp(data.lifecycle.processing_start_at)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>
                  {t('Earliest available')}
                </dt>
                <dd>{formatTimestamp(data.lifecycle.earliest_available_at)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>
                  {t('Estimated events')}
                </dt>
                <dd>{data.lifecycle.estimated_count}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('Due now')}</dt>
                <dd>{data.lifecycle.due_count}</dd>
              </div>
            </dl>
          </div>
          <p className='text-muted-foreground text-sm'>
            {t('Send-time rechecks can reduce the final recipient count.')}
          </p>
          <div>
            <h3 className='mb-2 font-medium'>{t('Masked event sample')}</h3>
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr className='border-b'>
                    <th className='p-2'>{t('ID')}</th>
                    <th className='p-2'>{t('Event type')}</th>
                    <th className='p-2'>{t('User')}</th>
                    <th className='p-2'>{t('Scope')}</th>
                    <th className='p-2'>{t('Business key')}</th>
                    <th className='p-2'>{t('Recipient')}</th>
                    <th className='p-2'>{t('Disposition')}</th>
                    <th className='p-2'>{t('Occurred at')}</th>
                    <th className='p-2'>{t('Available at')}</th>
                    <th className='p-2'>{t('Attempts')}</th>
                    <th className='p-2'>{t('Last error')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lifecycle.samples.map((sample) => (
                    <tr className='border-b last:border-0' key={sample.id}>
                      <td className='p-2'>{sample.id}</td>
                      <td className='p-2'>
                        {formatRecallLifecycleEventType(sample.event_type, t)}
                      </td>
                      <td className='p-2'>{sample.user}</td>
                      <td className='p-2'>
                        {sample.scope_type}: {sample.scope}
                      </td>
                      <td className='p-2'>{sample.business_key}</td>
                      <td className='p-2'>{sample.recipient_identity}</td>
                      <td className='p-2'>
                        {sample.disposition_reason_code
                          ? `${formatRecallLifecycleOutcomeCode(sample.disposition, t)} (${formatRecallLifecycleOutcomeCode(sample.disposition_reason_code, t)})`
                          : formatRecallLifecycleOutcomeCode(
                              sample.disposition,
                              t
                            )}
                      </td>
                      <td className='p-2'>
                        {formatTimestamp(sample.occurred_at)}
                      </td>
                      <td className='p-2'>
                        {formatTimestamp(sample.available_at)}
                      </td>
                      <td className='p-2'>{sample.attempt_count}</td>
                      <td className='p-2'>
                        {sample.last_error_code
                          ? formatRecallLifecycleOutcomeCode(
                              sample.last_error_code,
                              t
                            )
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : data ? (
        <div className='space-y-4'>
          <div>
            <strong>{t('Eligible total')}:</strong> {data.eligible_total}
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='rounded-lg border p-3'>
              <h3 className='font-medium'>{t('Exclusion counts')}</h3>
              <dl className='mt-2 space-y-1 text-sm'>
                {Object.entries(data.exclusions).map(([reason, count]) => (
                  <div className='flex justify-between gap-4' key={reason}>
                    <dt>{t(reason)}</dt>
                    <dd>{count}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className='rounded-lg border p-3'>
              <h3 className='font-medium'>
                {data.stripe
                  ? t('Promotion validation')
                  : t('Delivery validation')}
              </h3>
              {data.stripe ? (
                <>
                  <p>
                    {t('Coupon source')}: {t(data.stripe.coupon_source)}
                  </p>
                  <p>
                    {t('Coupon ID')}:{' '}
                    {data.stripe.coupon_id || t('Created automatically')}
                  </p>
                  {data.stripe.discount.type === 'fixed' ? (
                    <div>
                      <p className='font-medium'>
                        {t('Fixed discount amounts')}
                      </p>
                      {recallFixedCurrencies.map((currency) => {
                        const amount =
                          currency === 'USD'
                            ? data.stripe?.discount.amount_off
                            : (data.stripe?.discount.currency_options?.[
                                currency.toLowerCase()
                              ] ?? 0)
                        return (
                          <p key={currency}>
                            {currency}:{' '}
                            {formatRecallMinorAmount(currency, amount ?? 0) ||
                              '-'}
                          </p>
                        )
                      })}
                    </div>
                  ) : null}
                  <p>
                    {t('Resolved Products')}:{' '}
                    {data.stripe.product_ids.join(', ') || '-'}
                  </p>
                  <p>
                    {t('Top-up Stripe Price IDs')}:{' '}
                    {data.stripe.topup_price_ids.join(', ') || '-'}
                  </p>
                  <p>
                    {t('Subscription Stripe Price IDs')}:{' '}
                    {data.stripe.subscription_price_ids.join(', ') || '-'}
                  </p>
                </>
              ) : (
                <p>{t('Not applicable')}</p>
              )}
            </div>
          </div>
          <div>
            <h3 className='mb-2 font-medium'>{t('Masked candidate sample')}</h3>
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr className='border-b'>
                    <th className='p-2'>{t('User ID')}</th>
                    <th className='p-2'>{t('Email')}</th>
                    <th className='p-2'>{t('Language')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sample.map((candidate) => (
                    <tr
                      className='border-b last:border-0'
                      key={candidate.user_id}
                    >
                      <td className='p-2'>{candidate.user_id}</td>
                      <td className='p-2'>{candidate.email_masked}</td>
                      <td className='p-2'>{candidate.language}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
