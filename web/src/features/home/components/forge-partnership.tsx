import { Link } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
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
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { PRODUCT_NAME } from '@/lib/product-brand'

import {
  FORGE_ASSETS,
  FORGE_HACKATHON_URL,
  FORGE_MARK,
  FORGE_PARTNER_NAME,
  FORGE_SECTION_ID,
} from '../lib/forge-hackathon'
import { CiMark } from './ci-mark'

import './forge-partnership.css'

const FORGE_LOGO = `${FORGE_ASSETS}/qupper-forge-logo.webp`
// The all-green mark stands out among the monochrome partner logos.
const SELF_MARK = '/yeschoy-mark-green.svg'

/** Hero announcement that jumps to the hackathon spotlight below the fold. */
export function ForgeHeroBadge() {
  const { t } = useTranslation()

  // Grows the pill into the spotlight panel; the anchor jump stays the fallback.
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const modified =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    const section = document.querySelector<HTMLElement>(`#${FORGE_SECTION_ID}`)
    const panel = section?.querySelector<HTMLElement>('.ci-forgePanel')
    if (modified || !section || !panel) return

    panel.classList.remove('is-landed')
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (reducedMotion || !document.startViewTransition) {
      void panel.offsetWidth
      panel.classList.add('is-landed')
      return
    }

    event.preventDefault()
    const badge = event.currentTarget
    badge.style.setProperty('view-transition-name', 'forge-spotlight')
    const transition = document.startViewTransition(() => {
      badge.style.removeProperty('view-transition-name')
      panel.style.setProperty('view-transition-name', 'forge-spotlight')
      if (window.location.hash === `#${FORGE_SECTION_ID}`) {
        section.scrollIntoView({ block: 'start' })
      } else {
        window.location.hash = FORGE_SECTION_ID
      }
    })
    void transition.finished.finally(() => {
      panel.style.removeProperty('view-transition-name')
      panel.classList.add('is-landed')
    })
  }

  return (
    <a
      className='ci-forgeBadge'
      href={`#${FORGE_SECTION_ID}`}
      onClick={handleClick}
    >
      <span className='ci-forgeBadgeTag'>{t('Collab')}</span>
      <img src={FORGE_MARK} alt='' width={44} height={33} aria-hidden='true' />
      <span className='ci-forgeBadgeText'>
        <strong>
          Qupper&apos;s Forge{' '}
          <span className='ci-forgeBadgeWith'>
            <span aria-hidden='true'>×</span> {FORGE_PARTNER_NAME}
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

/**
 * Confirmed partners from the event's ecosystem page. Partners the event
 * still lists as "in talks" stay off this list until they are confirmed.
 */
function ForgeEcosystem() {
  const { t } = useTranslation()
  const partners = [
    {
      name: t('Fastrun Cloud'),
      role: t('Event host'),
      logo: {
        src: `${FORGE_ASSETS}/kuaipao-cloud.webp`,
        w: 650,
        h: 96,
        badge: false,
      },
    },
    {
      name: 'Moonstone',
      role: t('Event co-host'),
      logo: {
        src: `${FORGE_ASSETS}/moonstone.webp`,
        w: 299,
        h: 74,
        badge: true,
      },
    },
    { name: t('Wengu Bilingual School'), role: t('Venue partner') },
    { name: 'OpenForge', role: t('Mentors & developer community') },
  ]

  function renderPartner(partner: (typeof partners)[number]) {
    return (
      <li key={partner.name}>
        {partner.logo ? (
          <img
            src={partner.logo.src}
            alt={partner.name}
            width={partner.logo.w}
            height={partner.logo.h}
            className={
              partner.logo.badge ? 'ci-forgePartnerLogo--badge' : undefined
            }
            loading='lazy'
          />
        ) : (
          <strong>{partner.name}</strong>
        )}
        <span>{partner.role}</span>
      </li>
    )
  }

  return (
    <div className='ci-forgeEcosystem'>
      <p className='ci-forgeKicker' id='forge-ecosystem-title'>
        <span aria-hidden='true' />
        {t('Event partners')}
      </p>
      <ul aria-labelledby='forge-ecosystem-title'>
        {partners.slice(0, 1).map(renderPartner)}
        <li className='ci-forgeEcosystemSelf'>
          <CiMark size={36} src={SELF_MARK} withWordmark stackedWordmark />
          <span>{t('Model supply partner')}</span>
        </li>
        {partners.slice(1).map(renderPartner)}
      </ul>
    </div>
  )
}

export function ForgeSpotlight(props: { primaryTo: string; baseUrl: string }) {
  const { t } = useTranslation()
  const stats = [
    { value: t('4 days'), label: t('On-site build and demo') },
    { value: t('30 days'), label: t('Live trial run') },
    { value: '400+', label: t('Builders in the open call') },
    { value: '40', label: t('Finalist seats') },
  ]
  const tracks = [
    {
      kicker: 'BUILD THE FOUNDATION',
      name: t('Cloud native & infrastructure'),
    },
    { kicker: 'INTELLIGENCE, SHIPPED', name: t('AI-native products') },
    { kicker: 'MAKE SOMETHING REAL', name: t('Open theme') },
  ]

  return (
    <section
      className='ci-section ci-forgeSection'
      id={FORGE_SECTION_ID}
      aria-labelledby='forge-spotlight-title'
    >
      <div className='ci-container'>
        <div className='ci-forgePanel'>
          <div className='ci-forgeHead'>
            <div className='ci-forgeLockup'>
              <CiMark size={30} withWordmark />
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
            <p className='ci-forgeMeta'>
              <span>SEASON 02 · 2027</span>
              <span>{t('Dalian · date to be announced')}</span>
            </p>
          </div>

          <div className='ci-forgeBody'>
            <div className='ci-forgeCopy'>
              <p className='ci-forgeKicker'>
                <span aria-hidden='true' />
                {t('Hackathon model supply partner')}
              </p>
              <h2 id='forge-spotlight-title'>
                <span>BUILD FOR REAL.</span>{' '}
                <span className='ci-forgeAccent'>SHIP FOR MARKET.</span>
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
              <p className='ci-forgeNote'>
                {t('Free entry')} · {t('Solo or teams of up to 4')}
              </p>
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

          <dl className='ci-forgeStats'>
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>

          <ol className='ci-forgeTracks' aria-label={t('Tracks')}>
            {tracks.map((track, index) => (
              <li key={track.kicker}>
                <span className='ci-forgeTrackIndex'>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className='ci-forgeTrackKicker'>{track.kicker}</span>
                <strong>{track.name}</strong>
              </li>
            ))}
          </ol>

          <ForgeEcosystem />
        </div>
      </div>
    </section>
  )
}
