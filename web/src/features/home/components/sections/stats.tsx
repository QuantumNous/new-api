import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Section } from '@/components/layout/components/section'
import { getDefaultStats } from '../../constants'
import { StatItem } from '../stat-item'

interface StatItemProps {
  readonly value: string | number
  readonly suffix?: string
  readonly description?: string
}

interface StatsProps {
  items?: readonly StatItemProps[]
  className?: string
}

export function Stats({ items, className }: StatsProps) {
  const { t } = useTranslation()
  const displayItems = items ?? getDefaultStats(t)

  return (
    <Section className={cn('bg-muted/50', className)}>
      <div className='container mx-auto max-w-[1200px]'>
        <div className='grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-12'>
          {displayItems.map((item, index) => (
            <StatItem key={index} {...item} />
          ))}
        </div>
      </div>
    </Section>
  )
}
