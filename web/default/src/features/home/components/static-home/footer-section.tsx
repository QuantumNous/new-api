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
        <div>
          <img src='/assets/brand/aiapi114-logo-transparent.png' alt='AiApi114' />
          <p>{t('home.static.footer.text')}</p>
          <div>
            {footerSocials.map((social) => {
              const Icon = social.icon
              return (
                <a href={social.href} key={social.href} aria-label={t(social.labelKey)}>
                  <Icon className='size-5' />
                </a>
              )
            })}
          </div>
        </div>
        <div className='static-home__footer-columns'>
          {footerColumns.map((column) => (
            <section key={column.titleKey}>
              <h3>{t(column.titleKey)}</h3>
              {column.links.map((link) => (
                <a
                  href={link.href}
                  key={link.labelKey}
                  target={'external' in link && link.external ? '_blank' : undefined}
                  rel={'external' in link && link.external ? 'noreferrer' : undefined}
                >
                  {t(link.labelKey)}
                </a>
              ))}
            </section>
          ))}
        </div>
      </div>
      <div className='static-home__footer-bottom'>
        <button type='button'>
          <Globe2 className='size-4' />
          {language?.startsWith('zh') ? '??' : 'English'}
          <ChevronDown className='size-4' />
        </button>
        <p>? 2026 AiApi114. All rights reserved.</p>
        <Link to='/status'>
          <HeadsetIcon className='size-4' />
          {t('home.static.footer.status')}
        </Link>
      </div>
    </footer>
  )
}
