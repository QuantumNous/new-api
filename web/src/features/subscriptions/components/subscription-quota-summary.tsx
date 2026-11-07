import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'

import type { UserSubscription } from '../types'

interface Props {
  subscription: UserSubscription
}

export function SubscriptionQuotaSummary(props: Props) {
  const { t } = useTranslation()
  const sub = props.subscription
  const total = Number(sub.amount_total || 0)
  const dualQuota = sub.quota_model_version === 1
  const used = dualQuota
    ? Number(sub.total_amount_used || 0)
    : Number(sub.amount_used || 0)
  const totalReserved = dualQuota ? Number(sub.amount_reserved || 0) : 0
  const totalRemaining =
    total > 0 ? Math.max(0, total - used - totalReserved) : 0

  return (
    <div className='space-y-1' data-testid='subscription-quota-summary'>
      <div>
        {t('Total Quota')}:{' '}
        {total > 0 ? (
          <>
            {formatQuota(used)}/{formatQuota(total)} · {t('Remaining')}{' '}
            {formatQuota(totalRemaining)}
          </>
        ) : (
          t('Unlimited')
        )}
      </div>
      {dualQuota && total <= 0 && (
        <div className='text-muted-foreground text-xs'>
          {t('Unlimited total quota; window quota is not applied.')}
        </div>
      )}
      {dualQuota && total > 0 && (
        <div className='text-muted-foreground text-xs'>
          {t('Window quota')}:{' '}
          {formatQuota(
            Math.max(
              0,
              Number(sub.window_amount || 0) -
                Number(sub.window_amount_used || 0) -
                Number(sub.window_amount_reserved || 0)
            )
          )}{' '}
          / {formatQuota(Number(sub.window_amount || 0))}
        </div>
      )}
      {dualQuota && (
        <div className='text-muted-foreground text-xs'>
          {t('Historical consumption')}:{' '}
          {formatQuota(Number(sub.historical_amount_used || 0))}
        </div>
      )}
    </div>
  )
}
