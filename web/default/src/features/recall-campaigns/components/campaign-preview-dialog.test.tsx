import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallCampaignPreview } from '../types'
import { CampaignPreviewDialog } from './campaign-preview-dialog'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

describe('campaign preview dialog', () => {
  test('renders a fixed discount when currency options are null', () => {
    const campaignId = 42
    const preview = {
      eligible_total: 1,
      exclusions: {},
      sample: [],
      stripe: {
        coupon_source: 'automatic',
        coupon_id: '',
        discount: {
          type: 'fixed',
          percent_off: 0,
          amount_off: 500,
          currency: 'usd',
          currency_options: null,
          minimum_amount: 0,
          minimum_amount_currency: '',
        },
        topup_price_ids: [],
        subscription_price_ids: [],
        product_ids: [],
      },
    } satisfies RecallCampaignPreview
    const queryClient = new QueryClient()
    queryClient.setQueryData(['recall-campaigns', 'preview', campaignId], {
      data: preview,
    })

    expect(() =>
      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={testI18n}>
            <CampaignPreviewDialog
              campaignId={campaignId}
              open
              onOpenChange={() => undefined}
            />
          </I18nextProvider>
        </QueryClientProvider>
      )
    ).not.toThrow()
  })
})
