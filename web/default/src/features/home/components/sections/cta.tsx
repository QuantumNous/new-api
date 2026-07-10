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

import { HomeLink } from '../home-link'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

const HOME_BRAND_NAME = 'Lighting'

export function CTA(props: CTAProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'

  return (
    <section className='home-cta' id='contact'>
      <div className='home-shell'>
        <div className='home-cta-box'>
          <div>
            <h2>
              {t('Turn fragmented AI procurement into a unified service.')}
            </h2>
            <p>
              {t(
                'Whether you are building an internal enterprise AI gateway or need a more stable online token service, {{systemName}} provides a governable, billable, and operable access solution.',
                { systemName: HOME_BRAND_NAME }
              )}
            </p>
          </div>
          <div className='home-cta-actions'>
            <HomeLink
              href={props.isAuthenticated ? '/dashboard' : '/sign-up'}
              className='home-button home-button-primary home-button-large'
            >
              {props.isAuthenticated
                ? t('Go to Dashboard')
                : t('Get integration plan')}
            </HomeLink>
            <HomeLink
              href={docsUrl}
              className='home-button home-button-secondary home-button-large'
            >
              {t('View API docs')}
            </HomeLink>
          </div>
        </div>
      </div>
    </section>
  )
}
