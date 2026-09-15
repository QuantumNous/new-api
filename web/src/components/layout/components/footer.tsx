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
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/components/rich-content'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { resolveProductName } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

interface FooterProps {
  className?: string
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { footerHtml, logo, systemName } = useSystemConfig()
  const productName = resolveProductName(systemName)
  const currentYear = new Date().getFullYear()
  const legalLinks = [
    status?.user_agreement_enabled
      ? { href: '/user-agreement', label: t('User Agreement') }
      : null,
    status?.privacy_policy_enabled
      ? { href: '/privacy-policy', label: t('Privacy Policy') }
      : null,
  ].filter((link): link is { href: string; label: string } => link !== null)

  return (
    <footer
      className={cn('border-border/40 relative z-10 border-t', props.className)}
    >
      <div className='mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row'>
        <a href='/' className='flex items-center gap-2.5'>
          <img
            src={logo}
            alt={productName}
            className='size-7 rounded-lg object-contain'
          />
          <span className='text-sm font-semibold tracking-tight'>
            {productName}
          </span>
        </a>
        {footerHtml ? (
          <RichContent
            mode='html'
            content={footerHtml}
            className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
          />
        ) : null}
        <div className='text-muted-foreground/50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs sm:ms-auto'>
          {legalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className='hover:text-foreground transition-colors'
            >
              {link.label}
            </a>
          ))}
          <span>
            &copy; {currentYear}{' '}
            <a
              href='https://github.com/QuantumNous/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground/70 hover:text-foreground font-semibold transition-colors'
            >
              {t('New API')}
            </a>
            . {t('footer.defaultCopyright')}
          </span>
        </div>
      </div>
    </footer>
  )
}
