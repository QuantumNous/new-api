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
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useUsageSummary } from '@/features/usage-logs/hooks/use-usage-summary'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'

import './terminal-billing.css'

type TerminalBillingProps = {
  remainQuota: number | undefined
  usedQuota: number | undefined
  loading?: boolean
  children: React.ReactNode
}

export function TerminalBilling(props: TerminalBillingProps) {
  const { t, i18n } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const summary = useUsageSummary(10)
  const saved = summary.data?.saved_quota ?? 0
  const billed = summary.data?.quota ?? 0
  const percent =
    billed + saved > 0 ? Math.round((saved / (billed + saved)) * 100) : null
  const moneyOptions = {
    minimumFractionDigits: 2,
    locale: toIntlLocale(i18n.language),
  }
  const balance = Number.isFinite(props.remainQuota)
    ? formatQuotaWithCurrency(props.remainQuota, moneyOptions)
    : '—'
  const lifetimeSpending = Number.isFinite(props.usedQuota)
    ? formatQuotaWithCurrency(props.usedQuota, moneyOptions)
    : '—'

  return (
    <>
      <div className='ci-walletOverview'>
        <section
          className='ci-walletBalance'
          aria-label={t('Available balance')}
          aria-busy={props.loading}
        >
          <div>
            <p className='ci-walletBalanceLabel'>{t('Available balance')}</p>
            <strong className='ci-walletBalanceAmount'>{balance}</strong>
            <p className='ci-walletLifetime'>
              <span>{t('Lifetime spending')}</span>
              <span>{lifetimeSpending}</span>
            </p>
          </div>
          <a href='#topup' className='ci-button ci-button--size-sm'>
            {t('Top up')}
          </a>
        </section>

        {summary.error && (
          <p role='alert' className='ci-walletSavingsStatus'>
            {t('Savings unavailable')}
          </p>
        )}
        {!summary.error && summary.data && (
          <Collapsible
            className='ci-walletSavings'
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          >
            <div className='ci-walletSavingsRow'>
              <p className='ci-walletSavingsSummary'>
                <span>
                  {t('Saved {{amount}} in the last 10 days', {
                    amount: formatQuotaWithCurrency(saved, moneyOptions),
                  })}
                </span>
                {percent != null && <span>({percent}%)</span>}
              </p>
              <CollapsibleTrigger className='ci-walletSavingsToggle'>
                {detailsOpen ? t('Hide details') : t('View details')}
                <ChevronDown size={14} aria-hidden='true' />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent
              className='ci-walletSavingsDetails'
              role='region'
              aria-label={t('How much you saved')}
            >
              <p>{t('Last 10 days · recorded request rates')}</p>
              <dl>
                <div>
                  <dt>{t('You actually paid')}</dt>
                  <dd>{formatQuotaWithCurrency(billed, moneyOptions)}</dd>
                </div>
                <div>
                  <dt>{t('If you paid list price')}</dt>
                  <dd>
                    {formatQuotaWithCurrency(billed + saved, moneyOptions)}
                  </dd>
                </div>
              </dl>
            </CollapsibleContent>
          </Collapsible>
        )}
        {!summary.error && !summary.data && (
          <p className='ci-walletSavingsStatus' role='status'>
            {t('Loading...')}
          </p>
        )}
      </div>
      {props.children}
    </>
  )
}
