import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { SystemStatus } from '../types'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
  status?: SystemStatus | null
}

export function TermsFooter({
  variant = 'sign-in',
  className,
  status,
}: TermsFooterProps) {
  const { t } = useTranslation()
  const text =
    variant === 'sign-in'
      ? 'By clicking sign in, you agree to our'
      : 'By creating an account, you agree to our'

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  const agreementLink = {
    label: 'User Agreement',
    href: '/user-agreement',
  }
  const privacyLink = {
    label: 'Privacy Policy',
    href: '/privacy-policy',
  }

  const activeLinks =
    hasUserAgreement || hasPrivacyPolicy
      ? ([
          hasUserAgreement ? agreementLink : null,
          hasPrivacyPolicy ? privacyLink : null,
        ].filter(Boolean) as Array<{ label: string; href: string }>)
      : [agreementLink, privacyLink]

  const [firstLink, secondLink] = activeLinks

  return (
    <p className={cn('text-muted-foreground text-center text-xs', className)}>
      {text}{' '}
      {firstLink && (
        <a
          href={firstLink.href}
          className='hover:text-primary underline underline-offset-4'
        >
          {firstLink.label}
        </a>
      )}
      {secondLink && (
        <>
          {' '}
          {t('and')}{' '}
          <a
            href={secondLink.href}
            className='hover:text-primary underline underline-offset-4'
          >
            {secondLink.label}
          </a>
        </>
      )}
      .
    </p>
  )
}
