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
import { X } from 'lucide-react'
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
      className='relative z-50 bg-[#a83f2c] px-11 py-2 text-center text-[13px] leading-5 text-white'
    >
      <p className='mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5'>
        <span
          aria-hidden='true'
          className='hidden size-1.5 shrink-0 bg-white sm:inline-block'
        />
        <span>{content.segments.join(' | ')}</span>
        <Link
          to={isAuthenticated ? '/wallet' : '/sign-up'}
          className='font-semibold whitespace-nowrap underline underline-offset-4 hover:text-white/85 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
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
        className='absolute top-1/2 right-2 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white'
      >
        <X aria-hidden='true' />
      </Button>
    </div>
  )
}
