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

const CAPABILITIES = [
  {
    number: '01',
    labelKey: 'Unified access',
    titleKey: 'One API connects multiple upstream providers',
    descriptionKey:
      'Covers OpenAI, Claude, Gemini, Azure, AWS Bedrock, and other mainstream platforms, distributing by model, channel, priority, and weight.',
  },
  {
    number: '02',
    labelKey: 'Unified delivery',
    titleKey: 'Standardized quota and delivery methods',
    descriptionKey:
      'Provides API Credits, subscription top-ups, team accounts, and other delivery forms to reduce multi-platform procurement and settlement complexity.',
  },
  {
    number: '03',
    labelKey: 'Unified operations',
    titleKey: 'Turn availability into stable availability',
    descriptionKey:
      'Handles quota refill, issue response, and usage support while using multi-model and multi-channel redundancy to reduce outage risk.',
  },
  {
    number: '04',
    labelKey: 'Unified service',
    titleKey: 'Drive real business rollout',
    descriptionKey:
      'Provides usage coaching, prompt engineering, scenario rollout, and ongoing operations so customers can move from trials to production.',
  },
] as const
const HOME_BRAND_NAME = 'Lighting'

export function CapabilitiesSection() {
  const { t } = useTranslation()

  return (
    <section
      className='home-section home-section-muted'
      id='capabilities'
      aria-labelledby='capabilities-title'
    >
      <div className='home-shell'>
        <div className='home-section-heading'>
          <div className='home-section-kicker'>
            {t('Four core capability layers')}
          </div>
          <h2 className='home-section-title' id='capabilities-title'>
            {t('Move from model access to sustainable AI operations')}
          </h2>
          <p className='home-section-copy'>
            {t(
              'The homepage narrative shifts from token supply to enterprise service: access, delivery, operations, and service form the value of {{systemName}}.',
              { systemName: HOME_BRAND_NAME }
            )}
          </p>
        </div>

        <div className='home-capability-grid'>
          {CAPABILITIES.map((capability) => (
            <article className='home-capability-card' key={capability.number}>
              <span className='home-capability-number'>
                {capability.number}
              </span>
              <span className='home-capability-label'>
                {t(capability.labelKey)}
              </span>
              <h3>{t(capability.titleKey)}</h3>
              <p>{t(capability.descriptionKey)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
