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
import { Bell, Menu, Moon, Sun, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/language-switcher'
import { homeNavLinks } from './content'
import type { HomeAnnouncement, StaticHomeText } from './types'

type HomeNavProps = {
  announcement: HomeAnnouncement
  isDark: boolean
  mobileOpen: boolean
  setMobileOpen: (open: boolean | ((open: boolean) => boolean)) => void
  t: StaticHomeText
  toggleTheme: () => void
}

export function HomeNav({
  announcement,
  isDark,
  mobileOpen,
  setMobileOpen,
  t,
  toggleTheme,
}: HomeNavProps) {
  return (
    <header className='static-home__nav'>
      <div className='static-home__nav-inner'>
        <a className='static-home__brand' href='#top' aria-label='AiApi114'>
          <img
            className='static-home__brand-logo'
            src='/assets/brand/aiapi114-logo-transparent.png'
            alt='AiApi114'
          />
        </a>
        <nav className='static-home__nav-links' aria-label='Main'>
          {homeNavLinks.map((link) =>
            'disabled' in link && link.disabled ? (
              <span key={link.labelKey} aria-disabled='true'>
                {t(link.labelKey)}
              </span>
            ) : (
              <a key={link.labelKey} href={link.href}>
                {t(link.labelKey)}
              </a>
            )
          )}
        </nav>
        <div className='static-home__nav-actions'>
          <button
            type='button'
            className='static-home__notice-link'
            onClick={() => announcement.notifications.openDialog('announcements')}
          >
            <Bell className='size-4' />
            {t('home.static.notice.title')}
            <span>NEW</span>
          </button>
          <button
            type='button'
            className='static-home__theme-toggle'
            onClick={toggleTheme}
            aria-label={
              isDark ? t('home.static.theme.toLight') : t('home.static.theme.toDark')
            }
          >
            {isDark ? <Sun className='size-4' /> : <Moon className='size-4' />}
          </button>
          <LanguageSwitcher />
          <Link to='/sign-in' className='static-home__nav-button'>
            {t('home.static.auth.signIn')}
          </Link>
          <Link to='/sign-up' className='static-home__nav-button static-home__nav-button--solid'>
            {t('home.static.auth.signUp')}
          </Link>
        </div>
        <button
          type='button'
          className='static-home__mobile-button'
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
      {mobileOpen && (
        <div className='static-home__mobile-menu'>
          {homeNavLinks.map((link) => (
            <a
              key={link.labelKey}
              href={'disabled' in link && link.disabled ? '#top' : link.href}
              onClick={() => setMobileOpen(false)}
            >
              {t(link.labelKey)}
            </a>
          ))}
          <button type='button' onClick={toggleTheme}>
            {isDark ? <Sun className='size-4' /> : <Moon className='size-4' />}
            {isDark ? t('home.static.theme.toLight') : t('home.static.theme.toDark')}
          </button>
          <LanguageSwitcher />
        </div>
      )}
    </header>
  )
}
