import { cn } from '@/lib/utils'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
}

export function TermsFooter({
  variant = 'sign-in',
  className,
}: TermsFooterProps) {
  const text =
    variant === 'sign-in'
      ? 'By clicking sign in, you agree to our'
      : 'By creating an account, you agree to our'

  return (
    <p
      className={cn(
        'text-muted-foreground px-8 text-center text-xs',
        className
      )}
    >
      {text}{' '}
      <a
        href='/terms'
        className='hover:text-primary underline underline-offset-4'
      >
        Terms of Service
      </a>{' '}
      and{' '}
      <a
        href='/privacy'
        className='hover:text-primary underline underline-offset-4'
      >
        Privacy Policy
      </a>
      .
    </p>
  )
}
