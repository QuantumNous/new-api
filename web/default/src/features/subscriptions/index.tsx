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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { SubscriptionsDialogs } from './components/subscriptions-dialogs'
import { SubscriptionsPrimaryButtons } from './components/subscriptions-primary-buttons'
import {
  SubscriptionsProvider,
  useSubscriptions,
} from './components/subscriptions-provider'
import { PlansGrid } from './components/plans-grid'
import { SelfSubscriptionsTable } from './components/self-subscriptions-table'

function SubscriptionsContent() {
  const { t } = useTranslation()
  const { complianceConfirmed } = useSubscriptions()
  const [activeTab, setActiveTab] = useState<'plans' | 'subs'>('plans')

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Subscription Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Plan configuration and user subscription records')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <SubscriptionsPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            {/* Tabs */}
            <div className='flex border-b border-border'>
              <button
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'plans'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('plans')}
              >
                {t('Plans List')}
              </button>
              <button
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'subs'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('subs')}
              >
                {t('User Subscriptions')}
              </button>
            </div>

            {!complianceConfirmed && activeTab === 'plans' ? (
              <div className='rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
                {t(
                  'Subscription plan creation and changes are locked until the administrator confirms compliance terms in Payment Gateway settings.'
                )}
              </div>
            ) : null}

            {activeTab === 'plans' ? <PlansGrid /> : <SelfSubscriptionsTable />}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SubscriptionsDialogs />
    </>
  )
}

export function Subscriptions() {
  return (
    <SubscriptionsProvider>
      <SubscriptionsContent />
    </SubscriptionsProvider>
  )
}
