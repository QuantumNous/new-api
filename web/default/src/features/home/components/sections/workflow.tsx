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

const STEPS = [
  {
    number: '1',
    titleKey: 'Access assessment',
    descriptionKey:
      'Confirm business scenarios, model needs, deployment mode, permissions, and billing definitions.',
  },
  {
    number: '2',
    titleKey: 'Channel configuration',
    descriptionKey:
      'Configure upstream keys, model availability, route priorities, weights, and fallback.',
  },
  {
    number: '3',
    titleKey: 'Unified calls',
    descriptionKey:
      'Connect applications, developer tools, or internal enterprise systems through OpenAI-compatible APIs.',
  },
  {
    number: '4',
    titleKey: 'Operations iteration',
    descriptionKey:
      'Continuously track usage, costs, channel stability, and business rollout results.',
  },
] as const

export function WorkflowSection() {
  const { t } = useTranslation()

  return (
    <section
      className='home-section home-section-muted'
      id='workflow'
      aria-labelledby='workflow-title'
    >
      <div className='home-shell'>
        <div className='home-section-heading home-section-heading-center'>
          <div className='home-section-kicker'>{t('Delivery path')}</div>
          <h2 className='home-section-title' id='workflow-title'>
            {t(
              'From access assessment to ongoing operations, the path is clear and executable'
            )}
          </h2>
          <p className='home-section-copy'>
            {t(
              'For enterprise customers, emphasize governance and delivery certainty; for online token service, emphasize instant use and stable calls.'
            )}
          </p>
        </div>

        <div className='home-flow' aria-label={t('Delivery steps')}>
          {STEPS.map((step) => (
            <article className='home-flow-step' key={step.number}>
              <span className='home-flow-number'>{step.number}</span>
              <h3>{t(step.titleKey)}</h3>
              <p>{t(step.descriptionKey)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
