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
import {
  ArrowRight01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { DocsShell } from './components/docs-shell'
import { NumberedSteps } from './components/numbered-steps'

export function DocsPayment() {
  const { t } = useTranslation()

  return (
    <DocsShell
      pageId='payment'
      title={t('Billing and payment')}
      description={t(
        'Use the wallet to add balance, redeem a code, purchase a configured plan, transfer referral rewards, and review billing records.'
      )}
      toc={[
        { id: 'open-wallet', label: t('Open the wallet') },
        { id: 'online-top-up', label: t('Top up online') },
        { id: 'redeem-code', label: t('Redeem a code') },
        { id: 'subscription-plans', label: t('Subscription plans') },
        { id: 'referral-rewards', label: t('Referral rewards') },
        { id: 'verify-balance', label: t('Verify the balance change') },
        { id: 'troubleshooting', label: t('Troubleshooting') },
      ]}
    >
      <section id='open-wallet' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Open the wallet')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'The wallet shows your current balance and the funding options enabled by this site. Some sections may be hidden when the administrator has not configured them.'
          )}
        </p>
        <Button className='mt-5' render={<Link to='/wallet' />}>
          {t('Open wallet')}
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
        </Button>
      </section>

      <section id='online-top-up' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Top up online')}</h2>
        <NumberedSteps
          items={[
            t('Open the wallet and select an available online payment method.'),
            t(
              'Enter an amount that meets the minimum shown on the payment form.'
            ),
            t('Review the amount and payment method before confirming.'),
            t(
              'Complete payment on the provider page, then return to the wallet.'
            ),
            t(
              'Refresh the balance and open billing history to verify the result.'
            ),
          ]}
        />
        <Alert className='mt-6'>
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden='true' />
          <AlertTitle>{t('Payment methods vary')}</AlertTitle>
          <AlertDescription>
            {t(
              'Available providers, currencies, fees, and minimum amounts are controlled by the current site configuration.'
            )}
          </AlertDescription>
        </Alert>
      </section>

      <section id='redeem-code' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Redeem a code')}</h2>
        <NumberedSteps
          items={[
            t('Find the redemption code section on the wallet page.'),
            t('Enter the complete code without extra spaces.'),
            t('Submit the code once and wait for the confirmation message.'),
            t('Verify the added value in your balance and billing history.'),
          ]}
        />
        <p className='text-muted-foreground mt-4 leading-7'>
          {t(
            'When enabled, the wallet may also show an external purchase link for redemption codes. Confirm the destination before leaving the site.'
          )}
        </p>
      </section>

      <section id='subscription-plans' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Subscription plans')}</h2>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'If subscription plans are configured, compare their price, validity period, model access, and usage limits before purchasing.'
          )}
        </p>
        <p className='text-muted-foreground mt-3 leading-7'>
          {t(
            'A subscription quota and wallet balance can follow different billing rules. Check the plan details and usage logs instead of assuming they are interchangeable.'
          )}
        </p>
      </section>

      <section id='referral-rewards' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Referral rewards')}</h2>
        <NumberedSteps
          items={[
            t(
              'Copy your referral link from the Referral Program card and share it through channels permitted by the site.'
            ),
            t(
              'Use Pending, Total Earned, and Invites to track rewards and referral activity.'
            ),
            t(
              'When pending rewards are available, choose Transfer to Balance.'
            ),
            t(
              'Enter an amount between the displayed minimum and available rewards, then confirm the transfer.'
            ),
            t(
              'Verify that pending rewards decrease and the wallet balance increases.'
            ),
          ]}
        />
        <p className='text-muted-foreground mt-4 leading-7'>
          {t(
            'Referral reward transfer is disabled until the administrator confirms compliance terms.'
          )}
        </p>
      </section>

      <section id='verify-balance' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>
          {t('Verify the balance change')}
        </h2>
        <NumberedSteps
          items={[
            t('Open billing history and locate the newest transaction.'),
            t('Confirm the amount, status, and creation time.'),
            t(
              'After making a model request, compare the wallet balance with the detailed charge in usage logs.'
            ),
          ]}
        />
        <Button
          className='mt-5'
          variant='outline'
          render={<Link to='/usage-logs' />}
        >
          {t('Open usage logs')}
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
        </Button>
      </section>

      <section id='troubleshooting' className='scroll-mt-28'>
        <h2 className='text-2xl font-semibold'>{t('Troubleshooting')}</h2>
        <NumberedSteps
          items={[
            t(
              'If no payment method appears, the site may not have online payment enabled.'
            ),
            t(
              'If the amount is rejected, use at least the minimum shown for the selected payment method.'
            ),
            t(
              'If payment remains pending, keep the provider receipt and do not submit duplicate payments immediately.'
            ),
            t(
              'If a redemption code fails, check for spaces, prior use, expiration, or an incorrect code.'
            ),
          ]}
        />
      </section>
    </DocsShell>
  )
}
