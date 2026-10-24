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
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRODUCT_NAME } from '@/lib/product-brand'

import { CiMark } from './ci-mark'

import './forge-partnership.css'

export const FORGE_HACKATHON_URL = 'https://qupper.fastrun.com.cn/'
export const FORGE_SECTION_ID = 'hackathon'

const FORGE_LOGO = '/partners/qupper-forge/qupper-forge-logo.webp'
const FORGE_MARK = '/partners/qupper-forge/qupper-forge-mark.webp'

/** Hero announcement that jumps to the hackathon spotlight below the fold. */
export function ForgeHeroBadge() {
  const { t } = useTranslation()
  return (
    <a className='ci-forgeBadge' href={`#${FORGE_SECTION_ID}`}>
      <span className='ci-forgeBadgeTag'>{t('Collab')}</span>
      <img src={FORGE_MARK} alt='' width={44} height={33} aria-hidden='true' />
      <span className='ci-forgeBadgeText'>
        <strong>
          Qupper&apos;s Forge{' '}
          <span className='ci-forgeBadgeWith'>
            <span aria-hidden='true'>×</span> {PRODUCT_NAME}
          </span>
        </strong>
        <span>
          <span className='ci-forgeBadgeEvent'>
            {t('Fastrun Cloud Hackathon')}
          </span>
          <span className='ci-forgeBadgeRole'>{t('Model supply partner')}</span>
        </span>
      </span>
      <span className='ci-forgeBadgeArrow' aria-hidden='true'>
        <ArrowRight size={18} />
      </span>
    </a>
  )
}

export function ForgeSpotlight(props: { primaryTo: string; baseUrl: string }) {
  const { t } = useTranslation()
  const facts = [
    { value: t('4 days'), label: t('On-site build and demo') },
    { value: t('30 days'), label: t('Live trial run') },
    { value: t('Free entry'), label: t('Solo or teams of up to 4') },
    { value: '2027', label: t('Dalian · date to be announced') },
  ]
  const tracks = [
    t('Cloud native & infrastructure'),
    t('AI-native products'),
    t('Open theme'),
  ]

  return (
    <section
      className='ci-section ci-forgeSection'
      id={FORGE_SECTION_ID}
      aria-labelledby='forge-spotlight-title'
    >
      <div className='ci-container'>
        <div className='ci-forgeFrame'>
          <div className='ci-forgeCard'>
            <div className='ci-forgeTop'>
              <div className='ci-forgeLockup'>
                <CiMark size={34} withWordmark />
                <span className='ci-forgeCross' aria-hidden='true'>
                  ×
                </span>
                <img
                  src={FORGE_LOGO}
                  alt="Qupper's Forge"
                  width={560}
                  height={144}
                />
              </div>
              <span className='ci-forgeSeason'>SEASON 02</span>
            </div>

            <div className='ci-forgeMain'>
              <div className='ci-forgeCopy'>
                <p className='ci-forgeRole'>
                  <span aria-hidden='true' />
                  {t('Hackathon model supply partner')}
                </p>
                <h2 id='forge-spotlight-title'>
                  <span>BUILD FOR REAL.</span>{' '}
                  <span className='ci-forgeGradientText'>SHIP FOR MARKET.</span>
                </h2>
                <p className='ci-forgeLead'>
                  {t(
                    "{{product}} supplies the models for Qupper's Forge, the Fastrun Cloud hackathon. Teams call leading models through one OpenAI-compatible API and forge ideas into products they can ship.",
                    { product: PRODUCT_NAME }
                  )}
                </p>
                <div className='ci-forgeActions'>
                  <a
                    className='ci-button ci-button--size-sm ci-forgePrimary'
                    href={FORGE_HACKATHON_URL}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {t('Explore the hackathon')}
                    <span className='sr-only'> ({t('Open in new tab')})</span>
                    <ArrowUpRight size={17} aria-hidden='true' />
                  </a>
                  <Link
                    to={props.primaryTo}
                    className='ci-button ci-button--outline ci-button--size-sm ci-forgeSecondary'
                  >
                    {t('Start building')}{' '}
                    <ArrowRight size={17} aria-hidden='true' />
                  </Link>
                </div>
              </div>

              <div className='ci-forgeVisual' aria-hidden='true'>
                <div className='ci-forgeAnvil'>
                  <img src={FORGE_MARK} alt='' width={240} height={182} />
                  {[0, 1, 2, 3, 4, 5].map((spark) => (
                    <i key={spark} className='ci-forgeSpark' />
                  ))}
                </div>
                <div className='ci-forgeConsole'>
                  <div className='ci-forgeConsoleBar'>
                    <span>
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>forge.config.ts</b>
                  </div>
                  <p className='ci-forgeConsoleMuted'>
                    // Qupper&apos;s Forge × {PRODUCT_NAME}
                  </p>
                  <p>
                    baseURL: <em>&quot;{props.baseUrl}&quot;</em>
                  </p>
                  <p>
                    build: <em>&quot;for real&quot;</em>
                  </p>
                  <p>
                    ship: <em>&quot;for market&quot;</em>
                  </p>
                </div>
              </div>
            </div>

            <dl className='ci-forgeFacts'>
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>

            <div className='ci-forgeTracks'>
              <span>{t('Tracks')}</span>
              <ul>
                {tracks.map((track) => (
                  <li key={track}>{track}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
