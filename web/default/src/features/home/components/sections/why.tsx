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

const PAIN_POINTS = [
  {
    index: '01',
    titleKey: 'Multi-model access is fragmented and costly to integrate',
    descriptionKey:
      'Different upstream capabilities, APIs, and settlement models make it hard to define one enterprise access standard.',
  },
  {
    index: '02',
    titleKey: 'Account, quota, and channel stability are hard to control',
    descriptionKey:
      'A single upstream outage, insufficient quota, or risk-control change can disrupt real business continuity.',
  },
  {
    index: '03',
    titleKey: 'Having model access is not the same as business rollout',
    descriptionKey:
      'Enterprises still need prompt engineering, scenario consulting, usage audits, and ongoing operations support.',
  },
] as const
const HOME_BRAND_NAME = 'Lighting'

export function WhySection() {
  const { t } = useTranslation()

  return (
    <section
      className='home-section home-section-muted'
      aria-labelledby='why-title'
    >
      <div className='home-shell home-pain-grid'>
        <div className='home-quote-panel'>
          <div className='home-section-kicker'>
            {t('Why {{systemName}} is needed', {
              systemName: HOME_BRAND_NAME,
            })}
          </div>
          <h2 className='home-quote-text' id='why-title'>
            {t(
              'Enterprises do not need just another account. They need an AI access and service system that keeps working.'
            )}
          </h2>
          <p className='home-quote-note'>
            {t(
              'From multi-model procurement, account stability, quota refill, permission audits, and business rollout, {{systemName}} turns fragmented problems into one service window.',
              { systemName: HOME_BRAND_NAME }
            )}
          </p>
        </div>

        <div className='home-pain-list'>
          {PAIN_POINTS.map((item) => (
            <article className='home-pain-item' key={item.index}>
              <span className='home-item-index'>{item.index}</span>
              <div>
                <h3>{t(item.titleKey)}</h3>
                <p>{t(item.descriptionKey)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
