import { useTranslation } from 'react-i18next'

interface StatsProps {
  className?: string
}

interface StatItem {
  value: string
  label: string
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  // Capability-focused stats — for an MVP we don't have usage numbers to flex,
  // so highlight what the product can do today.
  const stats: StatItem[] = [
    { value: 'Seedance 2.0', label: t('Latest model') },
    { value: '1080p', label: t('Max resolution') },
    { value: '15s', label: t('Max duration') },
    { value: '$0.71', label: t('From / video') },
  ]

  return (
    <div className='border-border/40 bg-muted/10 relative z-10 border-y'>
      <div className='mx-auto max-w-6xl px-6 py-10 md:py-12'>
        <div className='grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {stats.map((s) => (
            <div
              key={s.label}
              className='flex flex-col items-center text-center'
            >
              <span className='text-2xl font-bold tracking-tight md:text-3xl'>
                {s.value}
              </span>
              <span className='text-muted-foreground mt-1.5 text-xs'>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
