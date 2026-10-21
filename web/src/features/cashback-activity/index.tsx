/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Gift, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Footer } from '@/components/layout/components/footer'
import { MarketingHeader } from '@/components/layout/components/marketing-header'
import { useTheme } from '@/context/theme-provider'
import { getPublicCashbackOffers } from '@/features/cashback/api'
import { formatCashbackCents } from '@/features/cashback/lib/format'
import type { CashbackPublicOffer } from '@/features/cashback/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import '@/features/home/components/home-glass.css'
import '@/styles/activity-landing.css'

function CurrentOffer(props: { offer: CashbackPublicOffer; locale?: string }) {
  const { t } = useTranslation()
  if (props.offer.strategy === 'rate') {
    return (
      <p>
        {t('Current rule: {{rate}}% of the top-up face amount', {
          rate: formatNumber((props.offer.rate_bps ?? 0) / 100, props.locale),
        })}
      </p>
    )
  }
  if (props.offer.strategy === 'per_hundred') {
    return (
      <p>
        {t('Current rule: {{reward}} back for every CNY 100 topped up', {
          reward: formatCashbackCents(
            (props.offer.fixed_per_hundred ?? 0) * 100,
            props.locale
          ),
        })}
      </p>
    )
  }
  return (
    <div className='activity-card__rules'>
      <p>{t('Current tiered rule (CNY per order):')}</p>
      <ul className='list-inside list-disc'>
        {(props.offer.tiers ?? []).map((tier) => (
          <li key={tier.threshold_cents}>
            {t('Top up {{threshold}} or more: {{reward}} back', {
              threshold: formatCashbackCents(
                tier.threshold_cents,
                props.locale
              ),
              reward: formatCashbackCents(tier.reward_cents, props.locale),
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CashbackActivityPage() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const offers = useQuery({
    queryKey: ['cashback', 'public-offers'],
    queryFn: getPublicCashbackOffers,
    retry: false,
    staleTime: 0,
    // Campaigns can end or be stopped while this page stays mounted.
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    meta: { errorToast: false },
  })
  const { resolvedTheme } = useTheme()
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const destination = isAuthenticated ? '/wallet' : '/sign-up'
  let status = t('Checking current offers…')
  if (offers.isError) {
    status = t('Current offers are temporarily unavailable.')
  } else if (!offers.isPending && !offers.isFetching) {
    status = offers.data?.active
      ? t('Current cashback rules')
      : t('No active cashback offers right now.')
  }

  return (
    <div
      className='ci-landing ci-theme ci-liquidHome activity-landing'
      data-theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    >
      <div className='ci-handoffRoot'>
        <MarketingHeader
          isAuthenticated={isAuthenticated}
          currentPage='activity'
        />
        <main>
          <section className='activity-hero' aria-labelledby='activity-title'>
            <div className='activity-hero__content'>
              <h1 id='activity-title'>{t('Top-up and inviter cashback')}</h1>
              <p className='activity-hero__intro'>
                {t(
                  'Depending on the activity, an eligible top-up may reward the payer and inviter separately. Rewards follow the rules active when payment succeeds.'
                )}
              </p>
              <Link
                to={destination}
                className='ci-button ci-button--default ci-button--size-sm activity-hero__action'
              >
                {isAuthenticated ? t('Wallet') : t('Get started')}
                <ArrowRight size={17} aria-hidden='true' />
              </Link>
            </div>
          </section>

          <p className='activity-offer-status' role='status'>
            {status}
          </p>
          <section
            className='activity-details'
            aria-label={t('Top-up and inviter cashback')}
          >
            <article className='activity-card'>
              <span className='activity-card__icon' aria-hidden='true'>
                <Wallet size={26} />
              </span>
              <span className='activity-card__index' aria-hidden='true'>
                01
              </span>
              <h2>{t('Top-up rewards')}</h2>
              {!offers.isFetching &&
              !offers.isError &&
              offers.data?.active &&
              offers.data.invitee ? (
                <CurrentOffer offer={offers.data.invitee} locale={locale} />
              ) : (
                <p>
                  {offers.isPending || offers.isFetching || offers.isError
                    ? t('Rule unavailable; check again later.')
                    : t('No active top-up payer offer right now.')}
                </p>
              )}
              <p>
                {t(
                  'Check your personal estimate in the wallet. Final rules and eligibility are determined when payment succeeds.'
                )}
              </p>
            </article>
            <article className='activity-card activity-card--invite'>
              <span className='activity-card__icon' aria-hidden='true'>
                <Users size={26} />
              </span>
              <span className='activity-card__index' aria-hidden='true'>
                02
              </span>
              <h2>{t('Invite rewards')}</h2>
              {!offers.isFetching &&
              !offers.isError &&
              offers.data?.active &&
              offers.data.inviter ? (
                <CurrentOffer offer={offers.data.inviter} locale={locale} />
              ) : (
                <p>
                  {offers.isPending || offers.isFetching || offers.isError
                    ? t('Rule unavailable; check again later.')
                    : t('No active inviter offer right now.')}
                </p>
              )}
              <p>
                {t(
                  'Inviter rewards require an eligible referral and review. Final rules are determined when payment succeeds.'
                )}
              </p>
              <Link to={destination} className='activity-card__link'>
                {isAuthenticated ? t('Your Referral Link') : t('Sign up')}
                <ArrowRight size={17} aria-hidden='true' />
              </Link>
            </article>
          </section>
          <p className='activity-disclaimer'>
            <Gift size={19} aria-hidden='true' />
            {t(
              'Offers depend on the current campaign, eligibility and limits. Orders below the configured threshold receive no gift.'
            )}
          </p>
        </main>
        <Footer />
      </div>
    </div>
  )
}
