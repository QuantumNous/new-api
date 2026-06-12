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
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { RedemptionsDialogs } from './components/redemptions-dialogs'
import { RedemptionsPrimaryButtons } from './components/redemptions-primary-buttons'
import { RedemptionsProvider } from './components/redemptions-provider'
import { RedemptionsTable } from './components/redemptions-table'

function StatCard({
  label,
  value,
  change,
  changeType,
}: {
  label: string
  value: string
  change?: string
  changeType?: 'up' | 'down'
}) {
  return (
    <div className='rounded-[8px] border border-border bg-card px-4 py-4 shadow-sm'>
      <div className='text-muted-foreground text-xs font-medium'>{label}</div>
      <div className='text-foreground mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums'>
        {value}
      </div>
      {change && (
        <div
          className={`mt-1 text-xs font-medium ${
            changeType === 'up' ? 'text-success' : 'text-destructive'
          }`}
        >
          {change}
        </div>
      )}
    </div>
  )
}

function RedemptionsContent() {
  const { t } = useTranslation()

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Redemption Codes')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Batch create, manage and redeem redemption codes')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <RedemptionsPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            {/* Stat cards */}
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              <StatCard label={t('Total Codes')} value='2,480' />
              <StatCard
                label={t('Redeemed')}
                value='1,892'
                change='76.3%'
                changeType='up'
              />
              <StatCard label={t('Unused')} value='456' />
              <StatCard
                label={t('Expired')}
                value='132'
                change='5.3%'
                changeType='down'
              />
            </div>

            <RedemptionsTable />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <RedemptionsDialogs />
    </>
  )
}

export function Redemptions() {
  return (
    <RedemptionsProvider>
      <RedemptionsContent />
    </RedemptionsProvider>
  )
}
