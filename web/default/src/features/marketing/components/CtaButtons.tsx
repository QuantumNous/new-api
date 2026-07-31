import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

import { trackEvent } from '../api'

interface CtaButtonsProps {
  primary: string
  secondary: string
  primaryTo?: string
  secondaryTo?: string
}

export function CtaButtons({
  primary,
  secondary,
  primaryTo = '/sign-in',
  secondaryTo = '/contact-sales',
}: CtaButtonsProps) {
  return (
    <div className='flex flex-wrap gap-4'>
      <Button
        className='bg-gradient-to-r from-[#4F8CFF] to-[#8B5CF6] text-white border-0 px-6 py-3 text-base'
        render={<Link to={primaryTo} />}
        onClick={() => trackEvent('pricing_click')}
      >
        {primary}
      </Button>
      <Button
        className='border border-white/20 bg-transparent text-foreground px-6 py-3 text-base'
        render={<Link to={secondaryTo} />}
      >
        {secondary}
      </Button>
    </div>
  )
}
