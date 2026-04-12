import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Glow } from '@/components/layout/components/glow'
import { Mockup, MockupFrame } from '@/components/layout/components/mockup'
import { Section } from '@/components/layout/components/section'
import { StatusBadge } from '@/components/status-badge'
import { AI_APPLICATIONS, AI_MODELS } from '../../constants'
import { ConnectionLine } from '../connection-line'
import { GatewayCard } from '../gateway-card'
import { HeroButtons } from '../hero-buttons'
import { ScrollingIcons } from '../scrolling-icons'

interface HeroProps {
  title?: string
  description?: string
  mockup?: React.ReactNode | false
  badge?: React.ReactNode | false
  buttons?: React.ReactNode | false
  className?: string
  isAuthenticated?: boolean
}

export function Hero({
  title,
  description,
  mockup,
  badge,
  buttons,
  className,
  isAuthenticated = false,
}: HeroProps) {
  const { t } = useTranslation()
  const { systemName, logo } = useSystemConfig()

  const defaultTitle = t('Unified API Management Platform')
  const defaultDescription = t(
    'A powerful API proxy service supporting OpenAI, Claude, Gemini and other mainstream AI models, helping you easily manage and call various API services'
  )
  const defaultBadge = (
    <StatusBadge variant='neutral' className='animate-appear' copyable={false}>
      <span className='text-muted-foreground'>
        {t('New upgrade with more powerful performance!')}
      </span>
      <Link to='/pricing' className='flex items-center gap-1'>
        {t('View Pricing')}
        <ArrowRight className='h-3 w-3' />
      </Link>
    </StatusBadge>
  )

  const finalTitle = title ?? defaultTitle
  const finalDescription = description ?? defaultDescription
  const finalBadge = badge === false ? null : (badge ?? defaultBadge)

  const glowAnimation = 'animate-appear-zoom animation-delay-1000 opacity-0'

  return (
    <Section className={cn('overflow-hidden pb-0', className)}>
      <div className='max-w-container mx-auto flex flex-col gap-12 pt-16 sm:gap-24'>
        <div className='flex flex-col items-center gap-6 text-center sm:gap-12'>
          {finalBadge}
          <h1 className='animate-appear from-foreground to-foreground/70 relative z-10 inline-block bg-gradient-to-r bg-clip-text text-4xl leading-tight font-semibold text-transparent drop-shadow-sm sm:text-6xl sm:leading-tight md:text-8xl md:leading-tight'>
            {finalTitle}
          </h1>
          <p className='animate-appear text-muted-foreground animation-delay-100 relative z-10 max-w-[740px] text-base font-medium opacity-0 sm:text-xl'>
            {finalDescription}
          </p>
          {buttons !== false &&
            (buttons || (
              <div className='animate-appear animation-delay-300 relative z-10 flex justify-center gap-4 opacity-0'>
                <HeroButtons isAuthenticated={isAuthenticated} />
              </div>
            ))}
          {mockup !== false && (
            <div className='relative w-full pt-12'>
              {mockup ? (
                <>
                  <MockupFrame
                    className='animate-appear animation-delay-700 opacity-0'
                    size='small'
                  >
                    <Mockup
                      type='responsive'
                      className='bg-background/90 w-full rounded-xl border-0'
                    >
                      {mockup}
                    </Mockup>
                  </MockupFrame>
                  <Glow variant='top' className={glowAnimation} />
                </>
              ) : (
                <>
                  <div className='animate-appear animation-delay-700 relative z-10 mx-auto max-w-7xl opacity-0'>
                    <div className='relative flex items-center justify-center gap-8 py-20 lg:gap-16'>
                      <ScrollingIcons icons={AI_APPLICATIONS} direction='up' />
                      <ConnectionLine direction='left' />
                      <GatewayCard logo={logo} systemName={systemName} />
                      <ConnectionLine direction='right' />
                      <ScrollingIcons icons={AI_MODELS} direction='down' />
                    </div>
                  </div>
                  <Glow variant='top' className={glowAnimation} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
