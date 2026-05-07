import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface HeroButtonsProps {
  isAuthenticated: boolean
}

/**
 * Hero section action buttons
 */
export function HeroButtons({ isAuthenticated }: HeroButtonsProps) {
  const { t } = useTranslation()
  if (isAuthenticated) {
    return (
      <Button size='lg' render={<Link to='/dashboard' />}>
        {t('Go to Dashboard')} <ArrowRight className='ml-2 h-5 w-5' />
      </Button>
    )
  }

  return (
    <>
      <Button size='lg' render={<Link to='/sign-up' />}>
        {t('Get Started')}
        <ArrowRight className='ml-2 h-5 w-5' />
      </Button>
      <Button size='lg' variant='outline' render={<Link to='/sign-in' />}>
        {t('Sign In')}
      </Button>
    </>
  )
}
