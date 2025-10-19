import { Link } from '@tanstack/react-router'
import { ArrowRight, Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Glow } from '@/components/layout/components/glow'
import { Mockup, MockupFrame } from '@/components/layout/components/mockup'
import { Section } from '@/components/layout/components/section'
import { AI_APPLICATIONS, AI_MODELS, GATEWAY_FEATURES } from '../../constants'
import { IconCard } from '../icon-card'

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
  title = 'Unified API Management Platform',
  description = 'A powerful API proxy service supporting OpenAI, Claude, Gemini and other mainstream AI models, helping you easily manage and call various API services',
  mockup,
  badge = (
    <Badge variant='outline' className='animate-appear'>
      <span className='text-muted-foreground'>
        New upgrade with more powerful performance!
      </span>
      <Link to='/pricing' className='flex items-center gap-1'>
        View Pricing
        <ArrowRight className='h-3 w-3' />
      </Link>
    </Badge>
  ),
  buttons,
  className,
  isAuthenticated = false,
}: HeroProps) {
  const { systemName, logo } = useSystemConfig()
  return (
    <Section className={cn('overflow-hidden pb-0 sm:pb-0 md:pb-0', className)}>
      <div className='max-w-container mx-auto flex flex-col gap-12 pt-16 sm:gap-24'>
        <div className='flex flex-col items-center gap-6 text-center sm:gap-12'>
          {badge !== false && badge}
          <h1 className='animate-appear from-foreground to-foreground/70 relative z-10 inline-block bg-gradient-to-r bg-clip-text text-4xl leading-tight font-semibold text-transparent drop-shadow-sm sm:text-6xl sm:leading-tight md:text-8xl md:leading-tight'>
            {title}
          </h1>
          <p className='animate-appear text-muted-foreground animation-delay-100 relative z-10 max-w-[740px] text-base font-medium opacity-0 sm:text-xl'>
            {description}
          </p>
          {buttons !== false &&
            (buttons || (
              <div className='animate-appear animation-delay-300 relative z-10 flex justify-center gap-4 opacity-0'>
                {isAuthenticated ? (
                  <Button size='lg' asChild>
                    <Link to='/dashboard'>
                      Go to Dashboard <ArrowRight className='ml-2 h-5 w-5' />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size='lg' asChild>
                      <Link to='/sign-up'>
                        Get Started
                        <ArrowRight className='ml-2 h-5 w-5' />
                      </Link>
                    </Button>
                    <Button size='lg' variant='outline' asChild>
                      <Link to='/sign-in'>
                        <Github className='mr-2 h-4 w-4' />
                        Sign In
                      </Link>
                    </Button>
                  </>
                )}
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
                  <Glow
                    variant='top'
                    className='animate-appear-zoom animation-delay-1000 opacity-0'
                  />
                </>
              ) : (
                <>
                  <div className='animate-appear animation-delay-700 relative z-10 mx-auto max-w-7xl opacity-0'>
                    <div className='relative flex items-center justify-center gap-8 py-20 lg:gap-16'>
                      {/* AI Applications - Left */}
                      <div className='scroll-container hidden h-[360px] overflow-hidden lg:block'>
                        <div className='animate-scroll-up flex flex-col gap-5'>
                          {/* First set */}
                          {AI_APPLICATIONS.map((iconName, i) => (
                            <IconCard key={`app-1-${i}`} iconName={iconName} />
                          ))}
                          {/* Duplicate set for seamless loop */}
                          {AI_APPLICATIONS.map((iconName, i) => (
                            <IconCard
                              key={`app-2-${i}`}
                              iconName={iconName}
                              className='aria-hidden'
                            />
                          ))}
                        </div>
                      </div>

                      {/* Simple Connection Line - Left */}
                      <div className='hidden lg:block'>
                        <div className='h-[2px] w-24 bg-gradient-to-r from-amber-500/60 to-amber-500/20' />
                      </div>

                      {/* Gateway Center Card - Enhanced */}
                      <div className='glass-3 group border-border/50 dark:border-border/20 relative overflow-hidden rounded-[32px] border p-10 shadow-2xl transition-all duration-500 sm:p-12 dark:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.4)]'>
                        {/* Top gradient border effect */}
                        <hr className='absolute top-0 left-[10%] h-[2px] w-[80%] border-0 bg-gradient-to-r from-transparent via-amber-500/80 to-transparent' />

                        {/* Ambient glow behind card */}
                        <div className='absolute -top-32 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-full bg-radial from-amber-500/30 to-amber-500/0 blur-3xl transition-all duration-500 group-hover:opacity-100 dark:opacity-80' />

                        <div className='relative'>
                          {/* Gateway Header with enhanced styling */}
                          <div className='mb-8 flex items-center justify-center gap-3'>
                            <img
                              src={logo}
                              alt={systemName}
                              className='h-12 w-12 rounded-lg object-cover'
                            />
                            <h3 className='from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent'>
                              {systemName}
                            </h3>
                          </div>

                          {/* Features Grid with glass morphism */}
                          <div className='grid grid-cols-2 gap-3'>
                            {GATEWAY_FEATURES.map((feature, i) => (
                              <div
                                key={i}
                                className='glass-morphism group/item border-border/40 dark:border-border/20 relative overflow-hidden rounded-xl border px-4 py-3.5 text-center shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/40 hover:shadow-md'
                              >
                                <div className='absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 transition-all duration-300 group-hover/item:from-amber-500/10' />
                                <span className='text-foreground/90 group-hover/item:text-foreground relative text-sm font-medium'>
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Simple Connection Line - Right */}
                      <div className='hidden lg:block'>
                        <div className='h-[2px] w-24 bg-gradient-to-r from-amber-500/20 to-amber-500/60' />
                      </div>

                      {/* AI Models - Right */}
                      <div className='scroll-container hidden h-[360px] overflow-hidden lg:block'>
                        <div className='animate-scroll-down flex flex-col gap-5'>
                          {/* First set */}
                          {AI_MODELS.map((iconName, i) => (
                            <IconCard
                              key={`model-1-${i}`}
                              iconName={iconName}
                            />
                          ))}
                          {/* Duplicate set for seamless loop */}
                          {AI_MODELS.map((iconName, i) => (
                            <IconCard
                              key={`model-2-${i}`}
                              iconName={iconName}
                              className='aria-hidden'
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Glow
                    variant='top'
                    className='animate-appear-zoom animation-delay-1000 opacity-0'
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
