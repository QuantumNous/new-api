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

const MODEL_PROVIDERS = [
  { name: 'OpenAI', detail: 'GPT / Responses' },
  { name: 'Claude', detail: 'Anthropic' },
  { name: 'Gemini', detail: 'Google AI' },
  { name: 'GLM', detailKey: 'Zhipu AI' },
  { name: 'Qwen', detailKey: 'Alibaba Qwen series' },
  { name: 'DeepSeek', detail: 'Reasoner / Chat' },
] as const

export function EcosystemSection() {
  const { t } = useTranslation()

  return (
    <section
      className='home-section'
      id='ecosystem'
      aria-labelledby='ecosystem-title'
    >
      <div className='home-shell home-ecosystem'>
        <div className='home-ecosystem-copy'>
          <div className='home-section-kicker'>
            {t('Ecosystem compatibility')}
          </div>
          <h2 id='ecosystem-title'>
            {t(
              'Connect OpenAI, Claude, Gemini, and other mainstream model providers.'
            )}
          </h2>
          <p>
            {t(
              "A unified API lets customers avoid handling each model provider's interfaces, accounts, and settlement details separately. One gateway covers common LLM calling scenarios."
            )}
          </p>
        </div>

        <div
          className='home-logo-grid'
          aria-label={t('Compatible model providers')}
        >
          {MODEL_PROVIDERS.map((provider) => (
            <div className='home-logo-card' key={provider.name}>
              <strong>{provider.name}</strong>
              <span>
                {'detailKey' in provider
                  ? t(provider.detailKey)
                  : provider.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
