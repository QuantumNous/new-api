import { useTranslation } from 'react-i18next'

type StatisticsCardProps = {
  label: string
  count: number
  total: number
}

export function StatisticsCard({ label, count, total }: StatisticsCardProps) {
  const { t } = useTranslation()
  return (
    <div className='rounded-md border p-3'>
      <div className='text-muted-foreground mb-1 text-xs font-medium'>
        {label}
      </div>
      <div className='flex items-baseline gap-2'>
        <span className='text-foreground text-2xl font-semibold'>{count}</span>
        <span className='text-muted-foreground text-sm'>
          {t('of')} {total}
        </span>
      </div>
    </div>
  )
}
