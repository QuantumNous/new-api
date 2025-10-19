import { cn } from '@/lib/utils'
import { Section } from '@/components/layout/components/section'

interface StatItemProps {
  label?: string
  value: string | number
  suffix?: string
  description?: string
}

interface StatsProps {
  items?: StatItemProps[]
  className?: string
}

export function Stats({
  items = [
    {
      value: '100',
      suffix: 'M+',
      description: 'requests served',
    },
    {
      value: '50',
      suffix: '+',
      description: 'AI models supported',
    },
    {
      value: '99.9',
      suffix: '%',
      description: 'uptime',
    },
    {
      value: '10',
      suffix: 'K+',
      description: 'active users',
    },
  ],
  className,
}: StatsProps) {
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
