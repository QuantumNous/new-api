import { useTranslation } from 'react-i18next'
import { Section } from '@/components/layout/components/section'
import { getDefaultFeatures } from '../../constants'
import { getFeatureIcon } from '../../lib/icon-mapper'
import { FeatureItem } from '../feature-item'

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

export function Features({ title, subtitle, items, className }: FeaturesProps) {
  const { t } = useTranslation()
  const displayTitle = title || t('Core Features')
  const displaySubtitle =
    subtitle ||
    t('Comprehensive API management solutions for developers and enterprises')
  const displayItems =
    items ??
    getDefaultFeatures(t).map((feature) => ({
      ...feature,
      icon: getFeatureIcon(feature.iconName, 'h-5 w-5 stroke-1'),
    }))

  return (
    <Section className={className}>
      <div className='max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-20'>
        <div className='flex flex-col items-center gap-4 text-center'>
          <h2 className='max-w-[560px] text-3xl leading-tight font-semibold sm:text-5xl sm:leading-tight'>
            {displayTitle}
          </h2>
          {displaySubtitle && (
            <p className='text-muted-foreground max-w-[600px] text-lg font-medium'>
              {displaySubtitle}
            </p>
          )}
        </div>
        <div className='grid auto-rows-fr grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'>
          {displayItems.map((item, index) => (
            <FeatureItem key={index} {...item} />
          ))}
        </div>
      </div>
    </Section>
  )
}
