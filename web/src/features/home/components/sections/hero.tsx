import { Link } from '@tanstack/react-router'
import { ArrowRight, Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Glow } from '@/components/layout/components/glow'
import { Mockup, MockupFrame } from '@/components/layout/components/mockup'
import { Section } from '@/components/layout/components/section'

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
                  <div className='animate-appear animation-delay-700 relative z-10 mx-auto max-w-6xl opacity-0'>
                    <div className='bg-background/50 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm'>
                      <div className='bg-muted/30 border-b p-3'>
                        <div className='flex gap-2'>
                          <div className='h-3 w-3 rounded-full bg-red-500'></div>
                          <div className='h-3 w-3 rounded-full bg-yellow-500'></div>
                          <div className='h-3 w-3 rounded-full bg-green-500'></div>
                        </div>
                      </div>
                      <div className='p-6'>
                        <div className='space-y-4'>
                          <div className='bg-muted h-8 w-48 animate-pulse rounded'></div>
                          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className='space-y-2 rounded-lg border p-4'
                              >
                                <div className='bg-muted h-6 w-24 animate-pulse rounded'></div>
                                <div className='bg-muted/50 h-4 w-full animate-pulse rounded'></div>
                              </div>
                            ))}
                          </div>
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
