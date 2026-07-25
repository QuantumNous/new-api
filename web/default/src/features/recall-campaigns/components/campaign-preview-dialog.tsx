import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { previewRecallCampaign } from '../api'
import { formatRecallMinorAmount, recallFixedCurrencies } from '../helpers'

interface CampaignPreviewDialogProps {
  campaignId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CampaignPreviewDialog(props: CampaignPreviewDialogProps) {
  const { t } = useTranslation()
  const preview = useQuery({
    queryKey: ['recall-campaigns', 'preview', props.campaignId],
    queryFn: () => previewRecallCampaign(props.campaignId),
    enabled: props.open && props.campaignId > 0,
  })
  const data = preview.data?.data

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Campaign preview')}</DialogTitle>
          <DialogDescription>
            {t(
              'Review eligibility, exclusions, Stripe Products, and Coupon validation before activation.'
            )}
          </DialogDescription>
        </DialogHeader>
        {preview.isLoading ? <p>{t('Loading')}</p> : null}
        {preview.isError ? (
          <p className='text-destructive'>
            {t('Failed to load campaign preview')}
          </p>
        ) : null}
        {data ? (
          <div className='space-y-4'>
            <div>
              <strong>{t('Eligible total')}:</strong> {data.eligible_total}
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              <div className='rounded-lg border p-3'>
                <h3 className='font-medium'>{t('Exclusion counts')}</h3>
                <dl className='mt-2 space-y-1 text-sm'>
                  {Object.entries(data.exclusions).map(([reason, count]) => (
                    <div className='flex justify-between gap-4' key={reason}>
                      <dt>{t(reason)}</dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className='rounded-lg border p-3'>
                <h3 className='font-medium'>{t('Stripe validation')}</h3>
                <p>
                  {t('Coupon source')}: {t(data.stripe.coupon_source)}
                </p>
                <p>
                  {t('Coupon ID')}:{' '}
                  {data.stripe.coupon_id || t('Created automatically')}
                </p>
                {data.stripe.discount.type === 'fixed' ? (
                  <div>
                    <p className='font-medium'>{t('Fixed discount amounts')}</p>
                    {recallFixedCurrencies.map((currency) => {
                      const amount =
                        currency === 'USD'
                          ? data.stripe.discount.amount_off
                          : (data.stripe.discount.currency_options[
                              currency.toLowerCase()
                            ] ?? 0)
                      return (
                        <p key={currency}>
                          {currency}:{' '}
                          {formatRecallMinorAmount(currency, amount) || '-'}
                        </p>
                      )
                    })}
                  </div>
                ) : null}
                <p>
                  {t('Resolved Products')}:{' '}
                  {data.stripe.product_ids.join(', ') || '-'}
                </p>
                <p>
                  {t('Top-up Stripe Price IDs')}:{' '}
                  {data.stripe.topup_price_ids.join(', ') || '-'}
                </p>
                <p>
                  {t('Subscription Stripe Price IDs')}:{' '}
                  {data.stripe.subscription_price_ids.join(', ') || '-'}
                </p>
              </div>
            </div>
            <div>
              <h3 className='mb-2 font-medium'>
                {t('Masked candidate sample')}
              </h3>
              <div className='overflow-x-auto rounded-lg border'>
                <table className='w-full text-left text-sm'>
                  <thead>
                    <tr className='border-b'>
                      <th className='p-2'>{t('User ID')}</th>
                      <th className='p-2'>{t('Email')}</th>
                      <th className='p-2'>{t('Language')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sample.map((candidate) => (
                      <tr
                        className='border-b last:border-0'
                        key={candidate.user_id}
                      >
                        <td className='p-2'>{candidate.user_id}</td>
                        <td className='p-2'>{candidate.email_masked}</td>
                        <td className='p-2'>{candidate.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
