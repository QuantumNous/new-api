/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

interface FooterProps {
  className?: string
}

const NEW_API_FOOTER_ATTRIBUTION_KEY = [
  'footer',
  'new' + 'api',
  'projectAttributionSuffix',
].join('.')

// Renders User Agreement / Privacy Policy links inline.
function LegalLinks() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const items: { key: string; label: string; href: string }[] = []
  if (status?.user_agreement_enabled) {
    items.push({
      key: 'user-agreement',
      label: t('User Agreement'),
      href: '/user-agreement',
    })
  }
  if (status?.privacy_policy_enabled) {
    items.push({
      key: 'privacy-policy',
      label: t('Privacy Policy'),
      href: '/privacy-policy',
    })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <>
      {items.map((item) => (
        <Fragment key={item.key}>
          <span aria-hidden='true' className='text-muted-foreground/30'>
            ·
          </span>
          <Link
            to={item.href}
            className='hover:text-primary transition-colors duration-200'
          >
            {item.label}
          </Link>
        </Fragment>
      ))}
    </>
  )
}

function ProjectAttribution(props: { currentYear: number }) {
  const { t } = useTranslation()
  return (
    <span className='text-muted-foreground/45'>
      &copy; {props.currentYear}{' '}
      <a
        href='https://github.com/QuantumNous/new-api'
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground/70 hover:text-foreground font-medium transition-colors'
      >
        {t('New API')}
      </a>
      . {t(NEW_API_FOOTER_ATTRIBUTION_KEY)}{' '}
      {t('| Based on')}{' '}
      <a
        href='https://github.com/songquanpeng/one-api'
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground/70 hover:text-foreground transition-colors'
      >
        {t('One API')}
      </a>{' '}
      &copy; 2023{' '}
      <a
        href='https://github.com/songquanpeng'
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground/70 hover:text-foreground transition-colors'
      >
        {t('JustSong')}
      </a>
      . {t('This project must be used in compliance with the')}{' '}
      <a
        href='https://github.com/QuantumNous/new-api/blob/main/LICENSE'
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground/70 hover:text-foreground transition-colors'
      >
        {t('AGPL v3.0 License')}
      </a>
      .
    </span>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  const displayName = systemName || 'Sundowner API'
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'border-border/40 relative z-10 border-t',
        props.className
      )}
    >
      <div className='mx-auto max-w-6xl px-6 py-6'>
        {/* Row 1: 站名 + 站内链接（文字链） */}
        <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:justify-start'>
          <span>
            {displayName} © {currentYear}
          </span>
          <span aria-hidden='true' className='text-muted-foreground/30'>
            ·
          </span>
          <Link
            to='/pricing'
            className='hover:text-primary transition-colors duration-200'
          >
            {t('Pricing')}
          </Link>
          <span aria-hidden='true' className='text-muted-foreground/30'>
            ·
          </span>
          <Link
            to='/rankings'
            className='hover:text-primary transition-colors duration-200'
          >
            {t('Rankings')}
          </Link>
          <LegalLinks />
        </div>

        {/* Row 2: 保护署名行 */}
        <div className='mt-2 text-center text-xs sm:text-left'>
          <ProjectAttribution currentYear={currentYear} />
        </div>
      </div>
    </footer>
  )
}
