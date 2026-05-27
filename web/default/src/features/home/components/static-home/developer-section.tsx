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
import { API_BASE_URL, CopyIcon, developerFeatures, supportCards } from './content'
import { useCodeExample } from './hooks'
import type { CopyToast, StaticHomeText } from './types'

export function DeveloperSection({
  copyToast,
  t,
}: {
  copyToast: CopyToast
  t: StaticHomeText
}) {
  const code = useCodeExample()

  return (
    <section className='static-home__section static-home__developer' id='developer'>
      <div className='static-home__developer-panel static-home__glass-card'>
        <div className='static-home__developer-column' data-home-reveal>
          <div className='static-home__developer-column-head'><h3>{t('home.static.developer.title')}</h3></div>
          <div className='static-home__developer-column-body static-home__code-panel'>
            <div className='static-home__feature-list'>
              {developerFeatures.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.titleKey}>
                    <span className='static-home__icon-badge'><Icon className='size-4' /></span>
                    <div>
                      <h4>{t(item.titleKey)}</h4>
                      <p>{t(item.textKey)}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
        <div className='static-home__developer-column static-home__developer-column--code' data-home-reveal>
          <div className='static-home__developer-column-head'><h3>{t('home.static.developer.apiTitle')}</h3></div>
          <div className='static-home__developer-column-body'>
            <div className='static-home__endpoint-input'>
              <span>{t('home.static.developer.endpointLabel')}</span>
              <code>{API_BASE_URL}</code>
              <button
                type='button'
                onClick={() => copyToast.copy(API_BASE_URL, t('home.static.toast.copied'))}
                aria-label={t('home.static.endpoint.copyApi')}
              >
                <CopyIcon className='size-4' />
              </button>
            </div>
            <div className='static-home__code-toolbar'>
              <div className='static-home__code-tabs'>
                {code.keys.map((key) => (
                  <button
                    type='button'
                    key={key}
                    className={key === code.activeKey ? 'is-active' : ''}
                    onClick={() => code.setActiveKey(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <button
                type='button'
                className='static-home__copy-code-button'
                onClick={() => copyToast.copy(code.code, t('home.static.toast.copied'))}
              >
                <CopyIcon className='size-4' />
                {t('home.static.developer.copyCode')}
              </button>
            </div>
            <pre className='static-home__code-block'><code>{code.code}</code></pre>
          </div>
        </div>
        <div className='static-home__developer-column' data-home-reveal>
          <div className='static-home__developer-column-head'><h3>{t('home.static.developer.supportTitle')}</h3></div>
          <div className='static-home__developer-column-body'>
            <div className='static-home__support-list'>
              {supportCards.map((card) => {
                const Icon = card.icon
                return 'href' in card && card.href ? (
                  <article className='static-home__support-card' key={card.titleKey}>
                    <span className='static-home__icon-badge'><Icon className='size-4' /></span>
                    <div>
                      <h4>{t(card.titleKey)}</h4>
                      <p>
                        <a href={card.href} target='_blank' rel='noreferrer' className='static-home__support-contact'>
                          {card.text}
                        </a>
                      </p>
                    </div>
                  </article>
                ) : (
                  <article className='static-home__support-card' key={card.titleKey}>
                    <span className='static-home__icon-badge'><Icon className='size-4' /></span>
                    <div>
                      <h4>{t(card.titleKey)}</h4>
                      <p>{'textKey' in card ? t(card.textKey) : card.text}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
