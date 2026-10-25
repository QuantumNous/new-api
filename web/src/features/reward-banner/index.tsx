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
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Gift, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getPublicCashbackOffers } from '@/features/cashback/api'
import {
  FORGE_MARK,
  FORGE_PARTNER_NAME,
  FORGE_SECTION_ID,
} from '@/features/home/lib/forge-hackathon'
import { useStatus } from '@/hooks/use-status'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth-store'

import { buildRewardBannerContent } from './lib/banner-content'

export const REWARD_BANNER_DISMISS_KEY = 'reward-banner-dismissed'
const BANNER_HEIGHT_VAR = '--reward-banner-height'
// Bump when the hackathon copy changes so a past dismissal does not hide it.
const FORGE_ANNOUNCEMENT_ID = 'qupper-forge-2026'

// Pages where marketing copy would interrupt a flow: install, sign-in
// handoffs, embedded assistant authorization, and error pages.
const HIDDEN_PREFIXES = [
  '/setup',
  '/oauth',
  '/desktop',
  '/desktop-authorize',
  '/partner-authorize',
  '/401',
  '/403',
  '/404',
  '/500',
  '/503',
]

function readDismissedKey(): string | null {
  try {
    return window.localStorage.getItem(REWARD_BANNER_DISMISS_KEY)
  } catch {
    return null
  }
}

/**
 * Site-wide strip announcing the Fastrun Cloud hackathon partnership beside
 * the live sign-up grant and top-up campaign.
 */
export function RewardBanner() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const hiddenRoute = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) => match.globalNotFound || match.status === 'notFound'
      ) ||
      HIDDEN_PREFIXES.some(
        (prefix) =>
          state.location.pathname === prefix ||
          state.location.pathname.startsWith(`${prefix}/`)
      ),
  })
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const { status } = useStatus()
  const offers = useQuery({
    queryKey: ['cashback', 'public-offers'],
    queryFn: getPublicCashbackOffers,
    retry: false,
    // A stopped campaign disappears within a minute or on the next focus.
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
    meta: { errorToast: false },
  })
  const [dismissedKey, setDismissedKey] = useState(readDismissedKey)
  const bannerRef = useRef<HTMLDivElement>(null)

  // A failed read hides every rule; a background refresh keeps the last
  // confirmed rules so the strip does not flicker each minute.
  const rewards =
    hiddenRoute || offers.isError
      ? null
      : buildRewardBannerContent(
          {
            signupQuota: status?.quota_for_new_user ?? 0,
            registerEnabled: status?.register_enabled === true,
            payerOffer: offers.data?.invitee,
          },
          { t, locale, formatQuota: (quota) => formatQuotaWithCurrency(quota) }
        )
  // One dismissal covers the whole strip until either announcement changes.
  const announcementKey = JSON.stringify({
    forge: FORGE_ANNOUNCEMENT_ID,
    rewards: rewards?.rulesKey ?? null,
  })
  const visible = !hiddenRoute && announcementKey !== dismissedKey

  // Full-height shells subtract this so the banner never adds a page scroll.
  useLayoutEffect(() => {
    const root = document.documentElement
    const element = bannerRef.current
    if (!visible || !element) {
      root.style.removeProperty(BANNER_HEIGHT_VAR)
      return
    }
    const publish = () =>
      root.style.setProperty(BANNER_HEIGHT_VAR, `${element.offsetHeight}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') {
      return () => root.style.removeProperty(BANNER_HEIGHT_VAR)
    }
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(BANNER_HEIGHT_VAR)
    }
  }, [visible])

  if (!visible) return null

  function dismiss() {
    try {
      window.localStorage.setItem(REWARD_BANNER_DISMISS_KEY, announcementKey)
    } catch {
      /* the dismissal still applies to this page view */
    }
    setDismissedKey(announcementKey)
  }

  return (
    <div
      ref={bannerRef}
      role='region'
      aria-label={t('Announcements')}
      className='border-foreground/5 bg-background text-foreground/80 relative z-50 overflow-hidden border-b px-11 py-1.5 text-center text-[13px] leading-5 dark:border-white/10'
    >
      {/* A soft lime → cyan wash continues the brand sweep of the page. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--brand-lime)_26%,transparent),color-mix(in_srgb,var(--brand-mint)_14%,transparent)_50%,color-mix(in_srgb,var(--brand-cyan)_22%,transparent))] dark:opacity-35'
      />
      <div className='relative mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-1'>
        <p className='flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5'>
          <img
            src={FORGE_MARK}
            alt=''
            width={22}
            height={17}
            aria-hidden='true'
            className='hidden shrink-0 drop-shadow-[0_0_4px_rgb(34_211_238/0.35)] sm:block'
          />
          <span className='tracking-wide'>
            <span className='text-foreground font-semibold'>
              {t('Fastrun Cloud Hackathon')}
            </span>{' '}
            <span aria-hidden='true' className='text-muted-foreground'>
              ×
            </span>{' '}
            {FORGE_PARTNER_NAME}
            <span className='text-muted-foreground'>
              {' · '}
              {t('Model supply partner')}
            </span>
          </span>
          <Link
            to='/'
            hash={FORGE_SECTION_ID}
            className='text-xs font-semibold whitespace-nowrap text-cyan-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-(--brand-cyan)'
          >
            {t('Explore the hackathon')} →
          </Link>
        </p>
        {rewards ? (
          <>
            <span
              aria-hidden='true'
              className='bg-foreground/15 hidden h-3.5 w-px md:block'
            />
            <p className='flex flex-wrap items-center justify-center gap-x-3 gap-y-1'>
              <span
                aria-hidden='true'
                className='hidden size-5 shrink-0 place-items-center rounded-md bg-(image:--brand-gradient) text-(--brand-ink) sm:grid'
              >
                <Gift className='size-3' strokeWidth={2.5} />
              </span>
              <span className='tracking-wide'>
                {rewards.segments.join(' | ')}
              </span>
              <Link
                to={isAuthenticated ? '/wallet' : '/sign-up'}
                className='bg-foreground text-background focus-visible:outline-foreground inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2'
              >
                {t('Top up now')} →
              </Link>
            </p>
          </>
        ) : null}
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={t('Close')}
        onClick={dismiss}
        className='text-foreground/50 hover:bg-foreground/5 hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2'
      >
        <X aria-hidden='true' />
      </Button>
    </div>
  )
}
