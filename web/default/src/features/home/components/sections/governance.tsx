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

const GOVERNANCE_ITEMS = [
  {
    titleKey: 'Identity and permissions',
    descriptionKey:
      'Supports passwords, OAuth, WebAuthn/Passkeys, JWT, and enterprise OAuth / OIDC SSO integrations.',
  },
  {
    titleKey: 'Organization roles',
    descriptionKey:
      'Owner, Admin, Billing, and Member roles provide layered authorization. Historical consumption during valid membership remains visible after a member leaves.',
  },
  {
    titleKey: 'Billing safety',
    descriptionKey:
      'Pre-deduction, settlement, and refund form a complete loop to prevent negative charges, overflow wraparound, and unaudited saturation clipping.',
  },
  {
    titleKey: 'Observability',
    descriptionKey:
      'Request logs capture model, channel, token usage, latency, status code, and support filtering, export, and multidimensional analysis.',
  },
] as const
const HOME_BRAND_NAME = 'Lighting'

export function GovernanceSection() {
  const { t } = useTranslation()

  return (
    <section
      className='home-section'
      id='governance'
      aria-labelledby='governance-title'
    >
      <div className='home-shell home-governance-layout'>
        <div className='home-governance-panel'>
          <div className='home-section-kicker'>
            {t('Enterprise governance and billing boundaries')}
          </div>
          <h2 id='governance-title'>
            {t(
              'Show the enterprise-wide view without breaking the personal deduction chain.'
            )}
          </h2>
          <p>
            {t(
              '{{systemName}} organizations are used for member grouping, reporting permissions, and aggregate views. The real deduction subject remains the personal account, and API requests do not need to carry or select an organization.',
              { systemName: HOME_BRAND_NAME }
            )}
          </p>
          <div className='home-boundary-box'>
            <strong>{t('Key boundary')}</strong>
            <span>
              {t(
                'Organizations are not payment subjects and do not hold balances, subscriptions, recharge orders, or API keys. Organization bills are aggregated from persisted member consumption logs during valid membership periods.'
              )}
            </span>
          </div>
        </div>

        <div className='home-governance-grid'>
          {GOVERNANCE_ITEMS.map((item) => (
            <article className='home-governance-item' key={item.titleKey}>
              <h3>{t(item.titleKey)}</h3>
              <p>{t(item.descriptionKey)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
