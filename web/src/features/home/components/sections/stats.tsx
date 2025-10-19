import { cn } from '@/lib/utils'
import { Section } from '@/components/layout/components/section'
import { DEFAULT_STATS } from '../../constants'
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

export function Stats({ items = DEFAULT_STATS, className }: StatsProps) {
  return (
    <Section className={cn('bg-muted/50', className)}>
      <div className='container mx-auto max-w-[1200px]'>
        <div className='grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-12'>
          {items.map((item, index) => (
            <StatItem key={index} {...item} />
          ))}
        </div>
      </div>
    </Section>
  )
}
