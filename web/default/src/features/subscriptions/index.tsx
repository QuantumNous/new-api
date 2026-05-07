import { useState } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import { GroupPlanMapping } from './components/group-plan-mapping'
import { SubscriptionUsageDashboard } from './components/subscription-usage-dashboard'
import { SubscriptionsDialogs } from './components/subscriptions-dialogs'
import { SubscriptionsPrimaryButtons } from './components/subscriptions-primary-buttons'
import { SubscriptionsProvider } from './components/subscriptions-provider'
import { SubscriptionsTable } from './components/subscriptions-table'

export function Subscriptions() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('plans')

  return (
    <SubscriptionsProvider>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Subscription Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage subscription plan creation, pricing and status')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <div className='flex items-center gap-2'>
            <Alert variant='default' className='hidden px-3 py-2 sm:flex'>
              <Info className='h-4 w-4' />
              <AlertDescription className='text-xs'>
                {t(
                  'Stripe/Creem requires creating products on the third-party platform and entering the ID'
                )}
              </AlertDescription>
            </Alert>
            <SubscriptionsPrimaryButtons />
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value='plans'>{t('Plans')}</TabsTrigger>
              <TabsTrigger value='group-mapping'>{t('Group Mapping')}</TabsTrigger>
              <TabsTrigger value='usage'>{t('Usage View')}</TabsTrigger>
            </TabsList>
            <TabsContent value='plans'>
              <SubscriptionsTable />
            </TabsContent>
            <TabsContent value='group-mapping'>
              <GroupPlanMapping />
            </TabsContent>
            <TabsContent value='usage'>
              <SubscriptionUsageDashboard />
            </TabsContent>
          </Tabs>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SubscriptionsDialogs />
    </SubscriptionsProvider>
  )
}
