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
import { ChevronDown, Globe2 } from 'lucide-react'
import { footerColumns, footerSocials, HeadsetIcon } from './content'
import { getStaticHomeLanguageLabel } from './translations'
import type { StaticHomeText } from './types'

export function HomeFooter({
  language,
  t,
}: {
  language: string
  t: StaticHomeText
}) {
  return (
    <footer className='static-home__footer' id='footer'>
      <div className='static-home__footer-main'>
        <div className='static-home__footer-intro'>
          <div className='static-home__brand static-home__brand--footer'>
            <img
              className='static-home__brand-logo'
              src='/assets/brand/aiapi114-logo-transparent.png'
              alt='AiApi114'
            />
          </div>
          <p>{t('home.static.footer.text')}</p>
          <div className='static-home__footer-socials'>
            {footerSocials.map((social) => {
              const Icon = social.icon
              return (
                <a
                  className='static-home__footer-social'
                  href={social.href}
                  key={social.href}
                  aria-label={t(social.labelKey)}
                >
                  <Icon className='size-4' />
                </a>
              )
            })}
          </div>
        </div>
        <div className='static-home__footer-columns'>
          {footerColumns.map((column) => (
            <section className='static-home__footer-column' key={column.titleKey}>
              <h3>{t(column.titleKey)}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link.labelKey}>
                    <a
                      href={link.href}
                      target={'external' in link && link.external ? '_blank' : undefined}
                      rel={'external' in link && link.external ? 'noreferrer' : undefined}
                    >
                      {t(link.labelKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <div className='static-home__footer-bottom'>
        <button type='button' className='static-home__footer-language'>
          <Globe2 className='size-4' />
          {getStaticHomeLanguageLabel(language)}
          <ChevronDown className='size-4' />
        </button>
        <p className='static-home__footer-copyright'>© 2026 AiApi114. All rights reserved.</p>
        <Link to='/status' className='static-home__footer-status'>
          <span className='static-home__footer-status-dot' />
          <HeadsetIcon className='size-4' />
          {t('home.static.footer.status')}
        </Link>
      </div>
    </footer>
  )
}
