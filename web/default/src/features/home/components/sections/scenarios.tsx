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

import { HomeLink } from '../home-link'

const SCENARIOS = [
  {
    tagKey: 'Enterprise governance mode',
    titleKey: 'Enterprise-owned unified AI access platform',
    descriptionKey:
      'For organizations with clear IT governance, permission isolation, private deployment, or semi-managed needs.',
    features: [
      'Unify all enterprise AI access and aggregate 40+ upstream providers.',
      'Connect enterprise SSO / OIDC and authenticate by employee identity.',
      'View usage, cost, trends, and audits by department and organization.',
      'Manage channels, models, tokens, quotas, and permissions independently.',
    ],
    actionKey: 'View governance capabilities',
    actionHref: '#governance',
    actionClassName: 'home-button home-button-primary',
  },
  {
    tagKey: 'Online service mode',
    titleKey: 'eLight online AI token service',
    descriptionKey:
      'For teams and developers who do not want to build a platform but need stable multi-model token service.',
    features: [
      'Register to get an API key and integrate quickly with OpenAI-compatible SDKs.',
      'Use one key to access multiple models without maintaining upstream accounts separately.',
      'Multi-channel redundancy and automatic fallback reduce single-point interruption risk.',
      'API Credits, subscription top-ups, team accounts, and transparent bills.',
    ],
    actionKey: 'Start online integration',
    actionHref: '#contact',
    actionClassName: 'home-button home-button-teal',
  },
] as const

export function ScenariosSection() {
  const { t } = useTranslation()

  return (
    <section
      className='home-section'
      id='scenarios'
      aria-labelledby='scenarios-title'
    >
      <div className='home-shell'>
        <div className='home-section-heading home-section-heading-center'>
          <div className='home-section-kicker'>
            {t('Two business scenarios')}
          </div>
          <h2 className='home-section-title' id='scenarios-title'>
            {t('One technology platform for two enterprise stages')}
          </h2>
          <p className='home-section-copy'>
            {t(
              'Deployment mode and operating ownership differ, but both center on unified access, delivery, operations, and service.'
            )}
          </p>
        </div>

        <div className='home-scenario-grid'>
          {SCENARIOS.map((scenario) => (
            <article className='home-scenario-card' key={scenario.titleKey}>
              <span className='home-tag'>{t(scenario.tagKey)}</span>
              <h3>{t(scenario.titleKey)}</h3>
              <p>{t(scenario.descriptionKey)}</p>
              <ul className='home-feature-list'>
                {scenario.features.map((feature) => (
                  <li key={feature}>{t(feature)}</li>
                ))}
              </ul>
              <div className='home-card-action'>
                <HomeLink
                  href={scenario.actionHref}
                  className={scenario.actionClassName}
                >
                  {t(scenario.actionKey)}
                </HomeLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
