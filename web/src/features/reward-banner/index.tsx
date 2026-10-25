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
import { useStatus } from '@/hooks/use-status'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth-store'

import { buildRewardBannerContent } from './lib/banner-content'

export const REWARD_BANNER_DISMISS_KEY = 'reward-banner-dismissed'
const BANNER_HEIGHT_VAR = '--reward-banner-height'

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

/** Site-wide strip advertising the live sign-up grant and top-up campaign. */
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
  const content =
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
  const visible = content !== null && content.rulesKey !== dismissedKey

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
    if (!content) return
    try {
      window.localStorage.setItem(REWARD_BANNER_DISMISS_KEY, content.rulesKey)
    } catch {
      /* the dismissal still applies to this page view */
    }
    setDismissedKey(content.rulesKey)
  }

  return (
    <div
      ref={bannerRef}
      role='region'
      aria-label={t('Current rewards')}
      className='relative z-50 overflow-hidden border-b border-white/10 bg-(--brand-ink) px-11 py-1.5 text-center text-[13px] leading-5 text-white/90'
    >
      {/* A faint lime → cyan wash ties the strip to the brand sweep below. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_30%_0%,color-mix(in_srgb,var(--brand-lime)_14%,transparent),transparent_70%),radial-gradient(50%_140%_at_75%_100%,color-mix(in_srgb,var(--brand-cyan)_12%,transparent),transparent_70%)]'
      />
      <p className='relative mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1'>
        <span
          aria-hidden='true'
          className='hidden size-5 shrink-0 place-items-center rounded-md bg-(image:--brand-gradient) text-(--brand-ink) sm:grid'
        >
          <Gift className='size-3' strokeWidth={2.5} />
        </span>
        <span className='tracking-wide'>{content.segments.join(' | ')}</span>
        <Link
          to={isAuthenticated ? '/wallet' : '/sign-up'}
          className='inline-flex items-center rounded-full bg-(image:--brand-gradient) px-3 py-0.5 text-xs font-semibold whitespace-nowrap text-(--brand-ink) shadow-[0_0_12px_color-mix(in_srgb,var(--brand-mint)_35%,transparent)] transition-[filter,box-shadow] hover:shadow-[0_0_18px_color-mix(in_srgb,var(--brand-mint)_55%,transparent)] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-mint)'
        >
          {t('Top up now')} →
        </Link>
      </p>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={t('Dismiss reward banner')}
        onClick={dismiss}
        className='absolute top-1/2 right-2 -translate-y-1/2 text-white/60 hover:bg-white/10 hover:text-white'
      >
        <X aria-hidden='true' />
      </Button>
    </div>
  )
}
