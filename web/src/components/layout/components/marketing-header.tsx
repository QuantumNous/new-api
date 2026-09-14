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
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Menu,
  MonitorDown,
  Moon,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { useTheme } from '@/context/theme-provider'
import { CiMark } from '@/features/home/components/ci-mark'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

import { CommunityHelp } from './community-help'

type MarketingHeaderProps = {
  isAuthenticated: boolean
  currentPage?: 'home' | 'client'
}

export function MarketingHeader(props: MarketingHeaderProps) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const [navOpen, setNavOpen] = useState(false)
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const isDark = resolvedTheme === 'dark'

  return (
    <header className='ci-header'>
      <div className='ci-headerInner'>
        <a className='ci-logo' aria-label={`${PRODUCT_NAME} home`} href='/#top'>
          <CiMark size={22} withWordmark />
        </a>
        <nav
          id='main-navigation'
          className={cn('ci-nav', navOpen && 'is-open')}
          aria-label={t('Main navigation')}
        >
          <div className='ci-navLinks'>
            <a
              className='ci-navItem'
              href='/#models'
              onClick={() => setNavOpen(false)}
            >
              <Boxes
                className='ci-mobileNavIcon'
                size={18}
                aria-hidden='true'
              />
              <span>{t('Models')}</span>
            </a>
            {props.isAuthenticated ? (
              <Link
                className='ci-navItem'
                to='/guide'
                onClick={() => setNavOpen(false)}
              >
                <BookOpen
                  className='ci-mobileNavIcon'
                  size={18}
                  aria-hidden='true'
                />
                <span>{t('Docs')}</span>
              </Link>
            ) : null}
            <Link
              className='ci-navItem'
              to='/client'
              aria-current={props.currentPage === 'client' ? 'page' : undefined}
              onClick={() => setNavOpen(false)}
            >
              <MonitorDown
                className='ci-mobileNavIcon'
                size={18}
                aria-hidden='true'
              />
              <span>{t('Client')}</span>
            </Link>
          </div>
          <div className='ci-mobileNavActions'>
            {!props.isAuthenticated && (
              <Link
                to='/sign-in'
                className='ci-button ci-button--outline ci-button--size-xs'
              >
                {t('Sign in')}
              </Link>
            )}
            <Link
              to={primaryTo}
              className='ci-button ci-button--default ci-button--size-xs'
            >
              {props.isAuthenticated ? t('Overview') : t('Start saving')}
            </Link>
          </div>
        </nav>
        <div className='ci-headerControls'>
          <button
            className='ci-button ci-button--ghost ci-button--size-icon-sm ci-themeToggle'
            type='button'
            aria-label={
              isDark ? t('Switch to light theme') : t('Switch to dark theme')
            }
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <LanguageSwitcher />
          <CommunityHelp variant='header' />
          {props.isAuthenticated && <ProfileDropdown />}
          <div className='ci-desktopNavActions'>
            {!props.isAuthenticated && (
              <Link
                to='/sign-in'
                className='ci-button ci-button--ghost ci-button--size-xs'
              >
                {t('Sign in')}
              </Link>
            )}
            <Link
              to={primaryTo}
              className='ci-button ci-button--default ci-button--size-xs'
            >
              {props.isAuthenticated ? t('Overview') : t('Start saving')}{' '}
              <ArrowRight size={17} aria-hidden='true' />
            </Link>
          </div>
          <button
            className='ci-button ci-button--ghost ci-button--size-icon-sm ci-menuButton'
            type='button'
            aria-label={t('Open navigation')}
            aria-expanded={navOpen}
            aria-controls='main-navigation'
            onClick={() => setNavOpen((value) => !value)}
          >
            <Menu size={20} aria-hidden='true' />
          </button>
        </div>
      </div>
    </header>
  )
}
