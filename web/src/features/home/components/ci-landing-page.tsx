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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarOff,
  Copy,
  ExternalLink,
  Gauge,
  Search,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MarketingHeader } from '@/components/layout/components/marketing-header'
import { RichContent } from '@/components/rich-content'
import { useTheme } from '@/context/theme-provider'
import { useGuideAddress } from '@/features/guide/use-guide-address'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { cn } from '@/lib/utils'

import {
  filterCatalog,
  sortCatalog,
  uniqueVendors,
  type CatalogModality,
  type CatalogSort,
  type CatalogEntry,
} from '../lib/catalog'
import { formatPerMillionTokens } from '../lib/pricing-savings'
import { CatalogPrice } from './catalog-price'
import { CatalogVendorIcon } from './catalog-vendor-icon'
import { CiMark } from './ci-mark'
import { GlassCursor } from './glass-cursor'

import './home-glass.css'

const PROVIDERS = [
  { name: 'OpenAI', src: '/ci/lobe/openai-avatar.svg', mono: true },
  { name: 'Anthropic', src: '/ci/lobe/claude-avatar.svg' },
  { name: 'Google', src: '/ci/lobe/gemini-avatar.svg' },
  { name: 'Meta', src: '/ci/lobe/meta-avatar.svg' },
  {
    name: 'Black Forest Labs',
    src: '/ci/landing-handoff/lobe/flux.svg',
    mono: true,
  },
  {
    name: 'ElevenLabs',
    src: '/ci/landing-handoff/lobe/elevenlabs.svg',
    mono: true,
  },
  { name: 'Kuaishou', src: '/ci/landing-handoff/lobe/kling-color.svg' },
] as const

function ArrowIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='17'
      height='17'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M5 12h14' />
      <path d='m12 5 7 7-7 7' />
    </svg>
  )
}

function AnimatedPercent(props: { value: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const target = props.value
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900)
      setShown(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [props.value])
  return (
    <span className='ci-highlighter'>
      <span className='ci-animatedNumber'>{shown}%</span>
    </span>
  )
}

interface LandingPageProps {
  isAuthenticated: boolean
  models: CatalogEntry[]
  maxSavingsPercent: number
}

export function CiLandingPage(props: LandingPageProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { footerHtml } = useSystemConfig()
  const { resolvedTheme } = useTheme()
  const [revealed, setRevealed] = useState(false)
  const address = useGuideAddress()
  const clipboard = useCopyToClipboard({ notify: false })
  const primaryTo = props.isAuthenticated ? '/dashboard' : '/sign-up'
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const id = window.setTimeout(() => setRevealed(true), 40)
    return () => window.clearTimeout(id)
  }, [])

  const featured = useMemo(
    () =>
      props.models
        .filter((model) => model.quote)
        .sort((a, b) => b.savingsPercent - a.savingsPercent)[0],
    [props.models]
  )

  return (
    <div
      className='ci-landing ci-theme ci-liquidHome'
      data-theme={isDark ? 'dark' : 'light'}
    >
      <GlassCursor />
      <div className='ci-handoffRoot'>
        <MarketingHeader
          isAuthenticated={props.isAuthenticated}
          currentPage='home'
        />

        <main>
          <section className='ci-hero' id='top'>
            <div className='ci-heroGrid'>
              <div className='ci-heroCopy'>
                <div className='ci-heroBrand'>
                  <CiMark size={56} />
                  <span>{PRODUCT_NAME}</span>
                </div>
                <h1
                  className={cn(
                    'ci-revealHeading',
                    revealed && 'ci-revealHeadingVisible'
                  )}
                >
                  {props.maxSavingsPercent > 0 ? (
                    <>
                      <span>
                        <i>
                          {t('Save up to')}{' '}
                          <AnimatedPercent value={props.maxSavingsPercent} />
                        </i>
                      </span>
                      <span>
                        <i>
                          {t('on AI models')}
                          {featured ? (
                            <span
                              className='ci-heroModelLogo ci-heroModelLogoVisible'
                              aria-hidden='true'
                            >
                              <CatalogVendorIcon model={featured} />
                            </span>
                          ) : null}
                        </i>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <i>{t('Pay in yuan across models')}</i>
                      </span>
                      <span>
                        <i>{t('through one API')}</i>
                      </span>
                    </>
                  )}
                </h1>
                <p>
                  {t(
                    'Access leading discounted AI models from multiple providers through one OpenAI-compatible API,'
                  )}{' '}
                  <strong className='ci-heroCopyEmphasis'>
                    {t('without changing your request format.')}
                  </strong>
                </p>
                <div className='ci-heroActions'>
                  <Link
                    to={primaryTo}
                    className='ci-button ci-button--default ci-button--size-sm'
                  >
                    {t('Start saving')} <ArrowIcon />
                  </Link>
                </div>
                <div className='ci-trustRow'>
                  <span>
                    <Wallet size={15} /> {t('Fund from $5')}
                  </span>
                  <span>
                    <Gauge size={15} /> {t('Usage-based pricing')}
                  </span>
                  <span>
                    <CalendarOff size={15} /> {t('No monthly commitment')}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <Catalog models={props.models} />

          <section className='ci-section ci-integrationSection' id='connect'>
            <div className='ci-container'>
              <div className='ci-integrationFacts'>
                <span>{t('OpenAI SDK compatible')}</span>
                <span>{t('Model selected per request')}</span>
                <span>{t('Every request visible in History')}</span>
              </div>
              <div className='ci-integrationMain'>
                <div className='ci-integrationCopy'>
                  <h2>
                    {t('Change two values. Access every leading provider.')}
                  </h2>
                  <p>
                    {t(
                      'Replace your base URL and API key. Keep your messages, tools, streaming, and response handling exactly where they are.'
                    )}
                  </p>
                  <div className='ci-endpointCopy'>
                    <span>{t('Base URL')}</span>
                    <button
                      type='button'
                      aria-label={`Copy the ${PRODUCT_NAME} base URL`}
                      onClick={() => {
                        void clipboard.copyToClipboard(address.baseUrl)
                      }}
                    >
                      <Copy size={16} />
                      <code>{address.baseUrl}</code>
                      <small aria-live='polite'>
                        {clipboard.copiedText === address.baseUrl
                          ? t('Copied')
                          : t('Copy')}
                      </small>
                    </button>
                  </div>
                </div>
                <div className='ci-integrationVisual'>
                  <div className='ci-codeCard'>
                    <div className='ci-codeHeader'>
                      <span>base-url.ts</span>
                      <button
                        className='ci-button ci-button--ghost ci-button--size-xs ci-codeCopy'
                        type='button'
                        onClick={() => {
                          void clipboard.copyToClipboard(
                            `baseURL: "${address.baseUrl}"\napiKey: "sk-..."`
                          )
                        }}
                      >
                        <Copy size={16} /> {t('Copy')}
                      </button>
                    </div>
                    <div className='ci-codeBlock'>
                      <div className='ci-terminalEdit'>
                        <p>
                          <span className='ci-codeMuted'>
                            // Live configuration update
                          </span>
                        </p>
                        <p>
                          baseURL: <span>&quot;{address.baseUrl}&quot;</span>
                        </p>
                        <p className='ci-codePlaceholder'>
                          apiKey: <span>{t('not set')}</span>
                        </p>
                      </div>
                    </div>
                    {featured?.quote ? (
                      <div className='ci-rateComparison ci-rateComparisonActive'>
                        <div className='ci-rateComparisonHeader'>
                          <span>
                            <span aria-hidden='true'>// </span>
                            {t('Live rate comparison')}
                          </span>
                          <small>
                            {featured.modelName} · output / 1M tokens
                          </small>
                        </div>
                        <div className='ci-rateRow'>
                          <span>{PRODUCT_NAME}</span>
                          <progress
                            max={Math.max(featured.quote.baseOutputPrice, 0.01)}
                            value={featured.quote.siteOutputPrice}
                          />
                          <strong>
                            {formatPerMillionTokens(
                              featured.quote.siteOutputPrice
                            )}
                          </strong>
                        </div>
                        <div className='ci-rateRow'>
                          <span>{t('List price')}</span>
                          <progress
                            max={Math.max(featured.quote.baseOutputPrice, 0.01)}
                            value={featured.quote.baseOutputPrice}
                          />
                          <strong>
                            {formatPerMillionTokens(
                              featured.quote.baseOutputPrice
                            )}
                          </strong>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className='ci-integrationProviders'>
                <div className='ci-providerLogoViewport'>
                  <div className='ci-providerLogoTrack'>
                    {[0, 1].map((lane) => (
                      <div
                        className='ci-providerLogoGroup'
                        key={lane}
                        aria-hidden={lane === 1}
                      >
                        {PROVIDERS.map((provider) => (
                          <div
                            className={cn(
                              'ci-providerNetworkLogo',
                              'mono' in provider &&
                                provider.mono &&
                                'ci-providerNetworkLogoMono'
                            )}
                            key={`${lane}-${provider.name}`}
                          >
                            <span>
                              <img
                                alt=''
                                width={44}
                                height={44}
                                src={provider.src}
                              />
                              <strong>{provider.name}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Trust />

          <section className='ci-finalCta'>
            <div className='ci-container'>
              <h2
                className={cn(
                  'ci-revealHeading',
                  revealed && 'ci-revealHeadingVisible'
                )}
              >
                <span>
                  <i>{t('Lower the cost of your')}</i>
                </span>
                <span>
                  <i>{t('next API request')}</i>
                </span>
              </h2>
              <p>
                {t(
                  'Create an account, fund from $5, and keep your current request format.'
                )}
              </p>
              <div className='ci-heroActions'>
                <Link
                  to={primaryTo}
                  className='ci-button ci-button--default ci-button--size-sm'
                >
                  {t('Start saving')} <ArrowIcon />
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className='ci-siteFooter'>
          <div className='ci-container'>
            <div className='ci-siteFooterBrand'>
              <CiMark size={36} withWordmark />
              <p>{t('Professional AI model platform')}</p>
              {footerHtml ? (
                <RichContent
                  mode='html'
                  content={footerHtml}
                  className='custom-footer min-w-0 text-sm'
                />
              ) : null}
              {status?.user_agreement_enabled ||
              status?.privacy_policy_enabled ? (
                <div className='flex flex-wrap gap-x-4 gap-y-2 text-sm'>
                  {status?.user_agreement_enabled ? (
                    <a href='/user-agreement'>{t('User Agreement')}</a>
                  ) : null}
                  {status?.privacy_policy_enabled ? (
                    <a href='/privacy-policy'>{t('Privacy Policy')}</a>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className='ci-attribution'>
              <span className='sr-only'>
                {t(
                  'Frontend design and development by New API contributors.'
                )}{' '}
              </span>
              <a
                href='https://github.com/QuantumNous/new-api'
                target='_blank'
                rel='noopener noreferrer'
                title={t(
                  'Frontend design and development by New API contributors.'
                )}
              >
                New API
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Catalog(props: { models: CatalogEntry[] }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [vendor, setVendor] = useState('all')
  const [sort, setSort] = useState<CatalogSort>('discount-desc')
  const [modality, setModality] = useState<CatalogModality>('all')
  const vendors = useMemo(() => uniqueVendors(props.models), [props.models])
  const counts = useMemo(
    () => ({
      all: props.models.length,
      text: filterCatalog(props.models, '', 'all', 'text').length,
      image: filterCatalog(props.models, '', 'all', 'image').length,
      video: filterCatalog(props.models, '', 'all', 'video').length,
    }),
    [props.models]
  )
  const rows = useMemo(
    () =>
      sortCatalog(
        filterCatalog(props.models, query, vendor, modality),
        sort
      ).slice(0, 8),
    [modality, props.models, query, sort, vendor]
  )

  return (
    <section className='ci-section' id='models'>
      <div className='ci-container'>
        <div className='ci-sectionIntro ci-sectionIntroSplit'>
          <p className='ci-eyebrow'>
            <span className='ci-liveBadge'>{t('Live')}</span>
          </p>
          <h2>{t('See our live catalog rates')}</h2>
          <p className='ci-sectionCopy'>
            {t(
              'Browse available model capacity, compare market discounts, and inspect current activity across providers.'
            )}
          </p>
        </div>
        <div className='ci-catalogFilters'>
          <div className='ci-filterField'>
            <span className='ci-filterLabel'>{t('Search')}</span>
            <div className='ci-searchRoot'>
              <span className='ci-input-shell ci-input-shell--sm'>
                <span className='ci-input-shell__icon'>
                  <Search size={16} />
                </span>
                <input
                  data-size='sm'
                  className='ci-input ci-input--sm ci-searchInput'
                  placeholder={t('Search models or providers')}
                  aria-label={t('Search models or providers')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
            </div>
          </div>
          <div className='ci-filterSelects'>
            <div className='ci-filterField'>
              <span className='ci-filterLabel'>{t('Provider')}</span>
              <select
                aria-label={t('Filter by provider')}
                className='ci-input ci-input--sm'
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
              >
                <option value='all'>{t('All providers')}</option>
                {vendors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className='ci-filterField'>
              <span className='ci-filterLabel'>{t('Sort by')}</span>
              <select
                aria-label={t('Sort models')}
                className='ci-input ci-input--sm'
                value={sort}
                onChange={(event) => setSort(event.target.value as CatalogSort)}
              >
                <option value='price-asc'>{t('Lowest price')}</option>
                <option value='discount-desc'>{t('Biggest savings')}</option>
                <option value='discount-asc'>{t('Smallest savings')}</option>
              </select>
            </div>
          </div>
        </div>
        <div className='ci-pricingPanel'>
          <div className='ci-catalogTabsRow'>
            <div className='ci-tabs ci-tabs--pill ci-catalogTabs'>
              <div
                role='tablist'
                className='ci-tabs__list'
                aria-label={t('Model type')}
              >
                {(
                  [
                    ['all', t('All models'), counts.all],
                    ['text', t('Text'), counts.text],
                    ['image', t('Image'), counts.image],
                    ['video', t('Video'), counts.video],
                  ] as const
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    type='button'
                    role='tab'
                    aria-selected={modality === id}
                    data-state={modality === id ? 'active' : 'inactive'}
                    className='ci-tabs__trigger'
                    onClick={() => setModality(id)}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className='ci-tableWrap' data-testid='live-catalog'>
            <table>
              <thead>
                <tr>
                  <th>{t('Model')}</th>
                  <th>{t('Input')}</th>
                  <th>{t('Output')}</th>
                  <th>{t('Discount')}</th>
                  <th>{t('24h traffic')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((model) => (
                  <tr key={model.modelName}>
                    <td>
                      <div className='ci-modelCell'>
                        <CatalogVendorIcon model={model} />
                        <div>
                          <strong>{model.modelName}</strong>
                          {model.savingsPercent > 0 ? (
                            <span className='ci-discountValue'>
                              {t('Save {{percent}}%', {
                                percent: model.savingsPercent,
                              })}
                            </span>
                          ) : null}
                          <small>
                            {model.modelName} · {model.vendorName}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <CatalogPrice model={model} side='input' />
                    </td>
                    <td>
                      <CatalogPrice model={model} side='output' />
                    </td>
                    <td>
                      {model.savingsPercent > 0
                        ? t('Save {{percent}}%', {
                            percent: model.savingsPercent,
                          })
                        : '—'}
                    </td>
                    <td>—</td>
                    <td>
                      <Link
                        to='/pricing/$modelId'
                        params={{ modelId: model.modelName }}
                        aria-label={model.modelName}
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='ci-tableExpand'>
            <p className='ci-panelNote'>
              {t(
                'Usage based. No separate routing surcharge. Never above direct list price.'
              )}
            </p>
            <Link
              to='/pricing'
              className='ci-button ci-button--outline ci-button--size-sm'
            >
              {t('View all {{count}} models', { count: props.models.length })}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Trust() {
  const { t } = useTranslation()
  return (
    <section className='ci-section ci-trustSection' id='trust'>
      <div className='ci-container'>
        <div className='ci-sectionIntro ci-sectionIntroSplit'>
          <h2>{t('Your data boundaries, clearly explained.')}</h2>
          <p className='ci-sectionCopy'>
            {t(
              'See what the marketplace records, where caching can occur, and which routes support zero-data-retention controls.'
            )}
          </p>
        </div>
        <div className='ci-trustGrid'>
          <a
            className='ci-trustCardLink ci-trustCard_records'
            href='/privacy-policy'
          >
            <div className='ci-card ci-card--flush ci-trustCard'>
              <div className='ci-trustVisual ci-trustRecordsVisual'>
                <div className='ci-trustTerminalPanel'>
                  <div className='ci-trustTerminalBar'>
                    <span className='ci-trustTerminalDots'>
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>request.log</b>
                  </div>
                  <div className='ci-trustTerminalBody'>
                    <p>
                      <span>›</span> POST /v1/chat/completions <b>200</b>
                    </p>
                    <p>
                      <span>›</span> model <em>gpt-5-mini</em>
                    </p>
                    <p>
                      <span>›</span> usage <em>1,284 tokens</em>
                    </p>
                    <p className='ci-trustTerminalImportant'>
                      <span>›</span>
                      <strong>content [not stored]</strong>
                    </p>
                  </div>
                </div>
              </div>
              <div className='ci-trustCardCopy'>
                <h3>{t('Application records')}</h3>
                <p>
                  {t(
                    'Usage and billing metadata only; never prompt or response bodies.'
                  )}
                </p>
                <span className='ci-trustCardAction'>
                  {t('Read the privacy policy')} <ExternalLink size={15} />
                </span>
              </div>
            </div>
          </a>
          <div className='ci-trustCardLink ci-trustCard_retention'>
            <div className='ci-card ci-card--flush ci-trustCard'>
              <div className='ci-trustCardCopy'>
                <h3>{t('Zero data retention available')}</h3>
                <p>
                  {t(
                    'Choose supported routes when your workload requires zero-retention controls.'
                  )}
                </p>
                <span className='ci-trustCardAction'>
                  {t('Check current security status')}
                </span>
              </div>
            </div>
          </div>
          <div className='ci-trustCardLink ci-trustCard_providers'>
            <div className='ci-card ci-card--flush ci-trustCard'>
              <div className='ci-trustCardCopy'>
                <h3>{t('Upstream providers')}</h3>
                <p>
                  {t(
                    'Each request reaches only the provider selected to serve that route.'
                  )}
                </p>
                <span className='ci-trustCardAction'>
                  {t('Review subprocessors')}
                </span>
              </div>
            </div>
          </div>
          <div className='ci-trustCardLink ci-trustCard_cache'>
            <div className='ci-card ci-card--flush ci-trustCard'>
              <div className='ci-trustCardCopy'>
                <h3>{t('Optional caching')}</h3>
                <p>
                  {t(
                    'Cache controls pass through when the selected model supports them.'
                  )}
                </p>
                <span className='ci-trustCardAction'>
                  {t('Review caching guidance')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
