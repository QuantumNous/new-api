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
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { CommunityHelp } from '@/components/layout/components/community-help'
import { useTheme } from '@/context/theme-provider'
import { CiMark } from '@/features/home/components/ci-mark'
import { GlassCursor } from '@/features/home/components/glass-cursor'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { PRODUCT_NAME } from '@/lib/product-brand'

import './access-auth-layout.css'

type AccessAuthLayoutProps = {
  title?: React.ReactNode
  description?: string
  children: React.ReactNode
}

export function AccessAuthLayout(props: AccessAuthLayoutProps) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const links = useTopNavLinks({ surface: 'public' })
  const isDark = resolvedTheme === 'dark'

  return (
    <div className='yecai-auth' data-theme={resolvedTheme}>
      <GlassCursor scopeSelector='.yecai-auth' />
      <header className='yecai-authHeader'>
        <Link to='/' className='yecai-authBrand' aria-label={PRODUCT_NAME}>
          <CiMark size={32} withWordmark />
        </Link>
        <nav className='yecai-authNav' aria-label={t('Main navigation')}>
          <Link to='/' className='yecai-authBack'>
            <ArrowLeft size={15} aria-hidden='true' />
            <span>{t('Back to home')}</span>
          </Link>
          {links.map((link) => (
            <Link key={link.href} to={link.href} className='yecai-authNavLink'>
              {link.title}
            </Link>
          ))}
          <CommunityHelp variant='header' />
          <span className='yecai-authNavDivider' aria-hidden='true' />
          <LanguageSwitcher />
          <button
            type='button'
            className='yecai-authTheme'
            aria-label={
              isDark ? t('Switch to light mode') : t('Switch to dark mode')
            }
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? (
              <Sun size={18} aria-hidden='true' />
            ) : (
              <Moon size={18} aria-hidden='true' />
            )}
          </button>
        </nav>
      </header>
      <main className='yecai-authMain'>
        <section className='yecai-authWelcome'>
          <p className='yecai-authEyebrow'>{PRODUCT_NAME} API</p>
          {props.title ? <h1>{props.title}</h1> : null}
          <p className='yecai-authDescription'>
            {props.description || t('One account for your AI workflow.')}
          </p>
        </section>
        <section className='yecai-authPanel' aria-label={t('Account access')}>
          {props.children}
        </section>
      </main>
    </div>
  )
}
