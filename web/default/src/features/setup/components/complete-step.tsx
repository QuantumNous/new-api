import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import type { SetupFormValues, SetupStatus } from '../types'

interface CompleteStepProps {
  status?: SetupStatus
  values: SetupFormValues
}

const USAGE_MODE_LABEL_KEYS: Record<SetupFormValues['usageMode'], string> = {
  external: 'External operations mode',
  self: 'Personal use mode',
  demo: 'Demo site mode',
}

const DATABASE_VARIANT: Record<
  string,
  'info' | 'success' | 'warning' | 'neutral'
> = {
  sqlite: 'warning',
  mysql: 'success',
  postgres: 'success',
}

export function CompleteStep({ status, values }: CompleteStepProps) {
  const { t } = useTranslation()
  const usageLabelKey = USAGE_MODE_LABEL_KEYS[values.usageMode]
  const dbType = status?.database_type ?? 'Unknown'
  const databaseVariant = DATABASE_VARIANT[dbType.toLowerCase()] ?? 'neutral'

  return (
    <div className='flex flex-col items-center gap-6 text-center'>
      <div className='rounded-2xl bg-emerald-500/10 p-4 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'>
        <CheckCircle2 className='size-8' />
      </div>
      <div className='space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          {t('Ready to initialize')}
        </h2>
        <p className='text-muted-foreground max-w-lg text-sm sm:text-base'>
          {t(
            'Double check the configuration below. Your system will be locked until initialization is complete.'
          )}
        </p>
      </div>

      <div className='bg-card w-full rounded-xl border p-6 text-left shadow-sm sm:p-8'>
        <dl className='grid gap-6'>
          <div className='space-y-1.5'>
            <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              {t('Database')}
            </dt>
            <dd className='flex flex-wrap items-center gap-2'>
              <span className='text-sm font-semibold'>{dbType}</span>
              <StatusBadge
                label={dbType}
                variant={databaseVariant}
                copyable={false}
              />
            </dd>
          </div>

          <Separator />

          <div className='space-y-1.5'>
            <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              {t('Administrator account')}
            </dt>
            <dd className='text-sm font-semibold'>
              {status?.root_init
                ? t('Existing account will be reused')
                : values.username || t('Not set yet')}
            </dd>
          </div>

          <Separator />

          <div className='space-y-1.5'>
            <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              {t('Usage mode')}
            </dt>
            <dd className='text-sm font-semibold'>{t(usageLabelKey)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
