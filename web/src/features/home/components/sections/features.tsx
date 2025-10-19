import { Section } from '@/components/layout/components/section'
import { DEFAULT_FEATURES } from '../../constants'
import { getFeatureIcon } from '../../lib/icon-mapper'

interface FeatureProps {
  readonly title: string
  readonly description: string
  readonly icon: React.ReactNode
}

interface FeaturesProps {
  title?: string
  subtitle?: string
  items?: readonly FeatureProps[]
  className?: string
}

export function Features({
  title = 'Core Features',
  subtitle = 'Comprehensive API management solutions for developers and enterprises',
  items = DEFAULT_FEATURES.map((feature) => ({
    ...feature,
    icon: getFeatureIcon(feature.iconName, 'h-5 w-5 stroke-1'),
  })),
  className,
}: FeaturesProps) {
  return (
    <Section className={className}>
      <div className='max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-20'>
        <div className='flex flex-col items-center gap-4 text-center'>
          <h2 className='max-w-[560px] text-3xl leading-tight font-semibold sm:text-5xl sm:leading-tight'>
            {title}
          </h2>
          {subtitle && (
            <p className='text-muted-foreground max-w-[600px] text-lg font-medium'>
              {subtitle}
            </p>
          )}
        </div>
        <div className='grid auto-rows-fr grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'>
          {items.map((item, index) => (
            <div
              key={index}
              className='group/feature text-foreground flex flex-col gap-4 p-4'
            >
              {/* Icon */}
              <div className='flex items-center self-start'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 shadow-inner ring-1 ring-amber-500/20 transition-all duration-300 group-hover/feature:scale-110 group-hover/feature:ring-amber-500/40'>
                  {item.icon}
                </div>
              </div>
              {/* Title */}
              <h3 className='text-sm leading-none font-semibold tracking-tight sm:text-base'>
                {item.title}
              </h3>
              {/* Description */}
              <div className='text-muted-foreground flex max-w-[240px] flex-col gap-2 text-sm text-balance'>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
