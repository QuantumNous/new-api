import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { SubscriptionsDialogs } from './components/subscriptions-dialogs'
import { SubscriptionsPrimaryButtons } from './components/subscriptions-primary-buttons'
import { SubscriptionsProvider } from './components/subscriptions-provider'
import { SubscriptionsTable } from './components/subscriptions-table'

export function Subscriptions() {
  const { t } = useTranslation()
  return (
    <SubscriptionsProvider>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('订阅管理')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('管理订阅套餐的创建、定价和启停')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <div className='flex items-center gap-3'>
            <Alert variant='default' className='py-2 px-3'>
              <Info className='h-4 w-4' />
              <AlertDescription className='text-xs'>
                {t('Stripe/Creem 需在第三方平台创建商品并填入 ID')}
              </AlertDescription>
            </Alert>
            <SubscriptionsPrimaryButtons />
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <SubscriptionsTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SubscriptionsDialogs />
    </SubscriptionsProvider>
  )
}
