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

import { useStatus } from '@/hooks/use-status'

import { HomeLink } from './home-link'

export function HomeFooter() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const displayName = (status?.system_name as string | undefined) || 'Lighting'
  const currentYear = new Date().getFullYear()

  return (
    <footer className='home-footer'>
      <div className='home-shell'>
        <div className='home-footer-main'>
          <div className='home-footer-brand'>
            <HomeLink href='/' className='home-footer-brand-link'>
              <span className='home-footer-logo'>
                <img
                  src='/lighting-logo-b.png'
                  alt={displayName}
                  width={176}
                  height={54}
                  loading='lazy'
                />
              </span>
            </HomeLink>
            <p className='home-footer-summary'>
              {t(
                'Enterprise AI unified access, delivery, and operations service platform'
              )}
            </p>
          </div>

          <nav className='home-footer-nav' aria-label={t('Footer')}>
            <div className='home-footer-link-group'>
              <p className='home-footer-heading'>{t('Platform')}</p>
              <div className='home-footer-links'>
                <HomeLink href={docsUrl} className='home-footer-link'>
                  {t('Docs')}
                </HomeLink>
                <HomeLink href='/dashboard' className='home-footer-link'>
                  {t('Console')}
                </HomeLink>
              </div>
            </div>

            <div className='home-footer-link-group'>
              <p className='home-footer-heading'>{t('Legal')}</p>
              <div className='home-footer-links'>
                <HomeLink href='/privacy-policy' className='home-footer-link'>
                  {t('Privacy Policy')}
                </HomeLink>
                <HomeLink href='/user-agreement' className='home-footer-link'>
                  {t('User Agreement')}
                </HomeLink>
              </div>
            </div>
          </nav>
        </div>

        <div className='home-footer-bottom'>
          <p>
            &copy; {currentYear} {displayName}. {t('footer.defaultCopyright')}
          </p>
          <p>
            {t(
              'Enterprise AI unified access, delivery, and operations service'
            )}
          </p>
        </div>
      </div>
    </footer>
  )
}
