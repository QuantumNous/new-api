import { cn } from '@/lib/utils'
import { Section } from '@/components/layout/components/section'
import { DEFAULT_STATS } from '../../constants'

interface StatItemProps {
  readonly label?: string
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
            <div
              key={index}
              className='flex flex-col items-center gap-2 text-center'
            >
              <div className='flex items-baseline gap-1'>
                <div className='from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent drop-shadow-sm transition-all duration-300 sm:text-5xl md:text-6xl'>
                  {item.value}
                </div>
                {item.suffix && (
                  <div className='from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent sm:text-4xl md:text-5xl'>
                    {item.suffix}
                  </div>
                )}
              </div>
              {item.description && (
                <div className='text-muted-foreground text-sm font-medium'>
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
