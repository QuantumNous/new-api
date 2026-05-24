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
          <h3>{t('home.static.developer.title')}</h3>
          {developerFeatures.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.titleKey}>
                <Icon className='size-5' />
                <div>
                  <h4>{t(item.titleKey)}</h4>
                  <p>{t(item.textKey)}</p>
                </div>
              </article>
            )
          })}
        </div>
        <div className='static-home__developer-column static-home__developer-column--code' data-home-reveal>
          <h3>{t('home.static.developer.apiTitle')}</h3>
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
            <button
              type='button'
              onClick={() => copyToast.copy(code.code, t('home.static.toast.copied'))}
            >
              <CopyIcon className='size-4' />
              {t('home.static.developer.copyCode')}
            </button>
          </div>
          <pre><code>{code.code}</code></pre>
        </div>
        <div className='static-home__developer-column' data-home-reveal>
          <h3>{t('home.static.developer.supportTitle')}</h3>
          {supportCards.map((card) => {
            const Icon = card.icon
            const content = (
              <>
                <Icon className='size-5' />
                <div>
                  <h4>{t(card.titleKey)}</h4>
                  <p>{'text' in card ? card.text : t(card.textKey)}</p>
                </div>
              </>
            )
            return 'href' in card && card.href ? (
              <a href={card.href} target='_blank' rel='noreferrer' key={card.titleKey}>
                {content}
              </a>
            ) : (
              <article key={card.titleKey}>{content}</article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
