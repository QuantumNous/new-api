import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Glow } from '@/components/layout/components/glow'
import { Section } from '@/components/layout/components/section'

interface CTAProps {
  title?: string
  description?: string
  buttons?: React.ReactNode
  className?: string
  isAuthenticated?: boolean
}

export function CTA({
  title = 'Start Building Today',
  description = 'Sign up, get your API Key, and start your AI application development journey',
  buttons,
  className,
  isAuthenticated = false,
}: CTAProps) {
  const { t } = useTranslation()
  if (isAuthenticated) {
    return null
  }

  return (
    <Section className={cn('group relative overflow-hidden', className)}>
      <div className='max-w-container relative z-10 mx-auto flex flex-col items-center gap-6 text-center sm:gap-8'>
        <h2 className='max-w-[640px] text-3xl leading-tight font-semibold sm:text-5xl sm:leading-tight'>
          {title}
        </h2>
        {description && (
          <p className='text-muted-foreground max-w-[600px] text-lg'>
            {description}
          </p>
        )}
        {buttons || (
          <div className='flex justify-center gap-4'>
            <Button size='lg' asChild>
              <Link to='/sign-up'>
                {t('Sign Up Free')} <ArrowRight className='ml-2 h-5 w-5' />
              </Link>
            </Button>
            <Button size='lg' variant='outline' asChild>
              <Link to='/pricing'>{t('View Pricing')}</Link>
            </Button>
          </div>
        )}
      </div>
      <div className='absolute top-0 left-0 h-full w-full translate-y-[1rem] opacity-80 transition-all duration-500 ease-in-out group-hover:translate-y-[-2rem] group-hover:opacity-100'>
        <Glow variant='bottom' />
      </div>
    </Section>
  )
}
