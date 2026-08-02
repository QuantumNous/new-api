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
import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarClock, Gift, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import ribbonAnimation from '@/assets/home/alltokenapi-smooth-ribbon-loop-v3.webp'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import { getAffiliateCampaign } from '../wallet/api'

function useAffiliateCampaign() {
  return useQuery({
    queryKey: ['affiliate', 'campaign'],
    queryFn: getAffiliateCampaign,
    select: (response) => response.data,
    staleTime: 5 * 60 * 1000,
  })
}

function isCampaignVisible(enabled: boolean, endsAt: number): boolean {
  return enabled && endsAt > Math.floor(Date.now() / 1000)
}

export function AffiliateCampaignBanner() {
  const { t } = useTranslation()
  const query = useAffiliateCampaign()
  const campaign = query.data
  if (!campaign || !isCampaignVisible(campaign.enabled, campaign.ends_at)) {
    return null
  }

  return (
    <section className='border-border bg-muted/25 border-y [contain-intrinsic-size:560px] [content-visibility:auto]'>
      <div className='mx-auto grid max-w-7xl md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]'>
        <div className='flex min-w-0 flex-col justify-center px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20'>
          <div className='text-primary text-xs font-semibold tracking-normal uppercase'>
            {t('Limited-time referral campaign')}
          </div>
          <h2 className='mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl'>
            {t('Invite friends and earn 25% cashback')}
          </h2>
          <p className='text-muted-foreground mt-4 max-w-2xl text-sm leading-6 sm:text-base sm:leading-7'>
            {t(
              'Every invited top-up earns you 25% CNY cashback, while your friend receives 20% extra quota.'
            )}
          </p>

          <div className='border-border mt-8 grid gap-6 border-y py-6 sm:grid-cols-2 sm:gap-0'>
            <div className='flex gap-3 sm:pr-6'>
              <WalletCards className='text-primary mt-1 size-5 shrink-0' />
              <div>
                <div className='text-2xl font-semibold'>25%</div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  {t('25% CNY cashback')}
                </div>
              </div>
            </div>
            <div className='flex gap-3 sm:border-l sm:pl-6'>
              <Gift className='text-primary mt-1 size-5 shrink-0' />
              <div>
                <div className='text-2xl font-semibold'>20%</div>
                <div className='text-muted-foreground mt-1 text-sm'>
                  {t('20% extra quota')}
                </div>
              </div>
            </div>
          </div>

          <div className='mt-7 flex flex-wrap items-center gap-4'>
            <Button render={<Link to='/campaign/referral' />}>
              {t('View campaign')}
              <ArrowRight data-icon='inline-end' />
            </Button>
            <span className='text-muted-foreground flex items-center gap-2 text-sm'>
              <CalendarClock className='size-4' aria-hidden='true' />
              {t('Ends {{time}}', {
                time: formatTimestampToDate(campaign.ends_at),
              })}
            </span>
          </div>
        </div>

        <div className='relative min-h-72 overflow-hidden md:min-h-full'>
          <img
            src={ribbonAnimation}
            alt=''
            loading='lazy'
            decoding='async'
            className='absolute inset-0 h-full w-full object-cover'
          />
          <div className='absolute inset-0 bg-black/35' />
          <div className='absolute inset-x-0 bottom-0 p-6 text-white sm:p-8'>
            <div className='text-xs font-semibold tracking-normal text-emerald-300 uppercase'>
              {t('Limited-time referral campaign')}
            </div>
            <div className='mt-2 text-2xl font-semibold'>
              {campaign.name || t('Invite rewards campaign')}
            </div>
            <div className='mt-2 text-sm text-white/75'>
              {t('Ends {{time}}', {
                time: formatTimestampToDate(campaign.ends_at),
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AffiliateCampaignPage() {
  const { t } = useTranslation()
  const query = useAffiliateCampaign()
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const campaign = query.data
  const visible = campaign
    ? isCampaignVisible(campaign.enabled, campaign.ends_at)
    : false

  return (
    <PublicLayout showMainContainer={false}>
      <main>
        <section className='relative min-h-[min(680px,82vh)] overflow-hidden bg-neutral-950 text-white'>
          <img
            src={ribbonAnimation}
            alt=''
            className='absolute inset-0 h-full w-full object-cover opacity-55'
          />
          <div className='absolute inset-0 bg-black/55' />
          <div className='relative mx-auto flex min-h-[min(680px,82vh)] max-w-7xl flex-col justify-end px-5 py-14 sm:px-8 sm:py-20'>
            <div className='max-w-3xl'>
              <p className='text-sm font-semibold tracking-normal text-emerald-300 uppercase'>
                {visible
                  ? t('Limited-time referral campaign')
                  : t('Referral campaign')}
              </p>
              <h1 className='mt-3 text-4xl font-semibold sm:text-5xl'>
                {campaign?.name || t('Invite rewards campaign')}
              </h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg'>
                {t(
                  'Invite a new user. You receive 25% of every eligible top-up as CNY cashback, and the invited user receives 20% extra quota.'
                )}
              </p>
              <div className='mt-7 flex flex-wrap gap-3'>
                <Button
                  size='lg'
                  render={
                    <Link to={isAuthenticated ? '/wallet' : '/sign-up'} />
                  }
                >
                  {isAuthenticated ? t('Open wallet') : t('Create account')}
                  <ArrowRight data-icon='inline-end' />
                </Button>
                {campaign?.ends_at ? (
                  <div className='flex items-center gap-2 rounded-md border border-white/25 bg-black/25 px-3 text-sm text-white/80'>
                    <CalendarClock className='size-4' />
                    {t('Ends {{time}}', {
                      time: formatTimestampToDate(campaign.ends_at),
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className='bg-background'>
          <div className='mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 md:py-20'>
            <div className='flex gap-4'>
              <WalletCards className='text-primary mt-1 size-6 shrink-0' />
              <div>
                <h2 className='text-xl font-semibold'>
                  {t('25% CNY cashback')}
                </h2>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {t(
                    'Cashback is recorded in your wallet after each eligible payment and can be transferred to your account balance after the hold period.'
                  )}
                </p>
              </div>
            </div>
            <div className='flex gap-4'>
              <Gift className='text-primary mt-1 size-6 shrink-0' />
              <div>
                <h2 className='text-xl font-semibold'>
                  {t('20% extra quota')}
                </h2>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {t(
                    'The invited user receives an additional 20% quota automatically when an eligible online top-up succeeds.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </PublicLayout>
  )
}
