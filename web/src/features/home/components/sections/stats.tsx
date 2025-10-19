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
      label: 'Served',
      value: '10',
      suffix: 'K+',
      description: 'developers and enterprise users',
    },
    {
      label: 'Processed',
      value: '100',
      suffix: 'M+',
      description: 'total API calls',
    },
    {
      label: 'Supported',
      value: '50',
      suffix: '+',
      description: 'mainstream AI models',
    },
    {
      label: 'Average response',
      value: '50',
      suffix: 'ms',
      description: 'ultra-low latency',
    },
  ],
  className,
}: StatsProps) {
  return (
    <Section className={cn('bg-muted/50', className)}>
      <div className='container mx-auto max-w-[960px]'>
        <div className='grid grid-cols-2 gap-12 sm:grid-cols-4'>
          {items.map((item, index) => (
            <div
              key={index}
              className='flex flex-col items-start gap-3 text-left'
            >
              {item.label && (
                <div className='text-muted-foreground text-sm font-semibold'>
                  {item.label}
                </div>
              )}
              <div className='flex items-baseline gap-2'>
                <div className='from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-4xl font-medium text-transparent drop-shadow-sm transition-all duration-300 sm:text-5xl md:text-6xl'>
                  {item.value}
                </div>
                {item.suffix && (
                  <div className='text-primary text-2xl font-semibold'>
                    {item.suffix}
                  </div>
                )}
              </div>
              {item.description && (
                <div className='text-muted-foreground text-sm font-semibold'>
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
