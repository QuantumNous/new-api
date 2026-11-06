import { useTranslation } from 'react-i18next'

import { formatTimestamp } from '../lib'

interface SubscriptionResetScheduleProps {
  lastResetTime?: number
  nextResetTime?: number
  resetPolicySource?: string
  legacyResetBaselineAt?: number
  className?: string
}

export function SubscriptionResetSchedule({
  lastResetTime = 0,
  nextResetTime = 0,
  resetPolicySource,
  legacyResetBaselineAt = 0,
  className,
}: SubscriptionResetScheduleProps) {
  const { t } = useTranslation()

  return (
    <>
      {lastResetTime > 0 && (
        <div className={className}>
          {t('Window started')}: {formatTimestamp(lastResetTime)}
        </div>
      )}
      {nextResetTime > 0 && (
        <div className={className}>
          {t('Next reset')}: {formatTimestamp(nextResetTime)}
        </div>
      )}
      {resetPolicySource === 'migration_baseline' && (
        <div className={className}>
          {t('Legacy migration baseline')}
          {legacyResetBaselineAt > 0
            ? `: ${formatTimestamp(legacyResetBaselineAt)}`
            : ''}
        </div>
      )}
      {resetPolicySource === 'legacy' && (
        <div className={className}>{t('Legacy reset policy')}</div>
      )}
    </>
  )
}
