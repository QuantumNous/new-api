import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionPageLayout } from '@/components/layout'
import {
  exportRecallCampaign,
  getRecallCampaign,
  getRecallCampaignMetrics,
  listRecallEvents,
  listRecallRecipients,
  recallCampaignKeys,
} from '../api'
import { getRecallPageCount, getRecallRecipientRetry } from '../helpers'
import type {
  RecallCampaignAction,
  RecallCampaignStatus,
  RecallRecipient,
} from '../types'
import { CampaignActionDialog } from './campaign-action-dialog'
import { CampaignEditor } from './campaign-editor'
import { CampaignPreviewDialog } from './campaign-preview-dialog'

const DETAIL_PAGE_SIZE = 100

function formatTimestamp(value: number): string {
  return value > 0 ? new Date(value * 1000).toLocaleString() : '-'
}

function actionsForStatus(
  status: RecallCampaignStatus
): RecallCampaignAction[] {
  if (status === 'draft') return ['activate', 'cancel']
  if (status === 'scheduled') return ['pause', 'cancel']
  if (status === 'running') return ['pause', 'complete', 'cancel']
  if (status === 'paused') return ['resume', 'complete', 'cancel']
  return []
}

interface CampaignDetailProps {
  campaignId: number
}

export function CampaignDetail(props: CampaignDetailProps) {
  const { t } = useTranslation()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [recipientPage, setRecipientPage] = useState(1)
  const [eventPage, setEventPage] = useState(1)
  const [dialog, setDialog] = useState<{
    action: RecallCampaignAction | 'retry'
    recipientId?: number
    uncertain?: boolean
  } | null>(null)
  const detailQuery = useQuery({
    queryKey: recallCampaignKeys.detail(props.campaignId),
    queryFn: () => getRecallCampaign(props.campaignId),
  })
  const recipientsQuery = useQuery({
    queryKey: recallCampaignKeys.recipients(props.campaignId, recipientPage),
    queryFn: () =>
      listRecallRecipients(props.campaignId, recipientPage, DETAIL_PAGE_SIZE),
    placeholderData: (previous) => previous,
  })
  const eventsQuery = useQuery({
    queryKey: recallCampaignKeys.events(props.campaignId, eventPage),
    queryFn: () =>
      listRecallEvents(props.campaignId, eventPage, DETAIL_PAGE_SIZE),
    placeholderData: (previous) => previous,
  })
  const metricsQuery = useQuery({
    queryKey: recallCampaignKeys.metrics(props.campaignId),
    queryFn: () => getRecallCampaignMetrics(props.campaignId),
  })
  const detail = detailQuery.data?.data
  const recipients = recipientsQuery.data?.data?.items ?? []
  const events = eventsQuery.data?.data?.items ?? []
  const metrics = metricsQuery.data?.data
  const recipientPageCount = getRecallPageCount(
    recipientsQuery.data?.data?.total ?? 0,
    DETAIL_PAGE_SIZE
  )
  const eventPageCount = getRecallPageCount(
    eventsQuery.data?.data?.total ?? 0,
    DETAIL_PAGE_SIZE
  )

  const downloadExport = async () => {
    const blob = await exportRecallCampaign(props.campaignId)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `recall-campaign-${props.campaignId}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const retryRecipient = (recipient: RecallRecipient) => {
    const retry = getRecallRecipientRetry(recipient)
    if (!retry.allowed) return
    setDialog({
      action: 'retry',
      recipientId: recipient.id,
      uncertain: retry.acknowledgeUncertain,
    })
  }

  if (detailQuery.isLoading) return <div className='p-4'>{t('Loading')}</div>
  if (!detail)
    return (
      <div className='text-destructive p-4'>{t('Failed to load campaign')}</div>
    )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Breadcrumb>
        <Button variant='link' render={<Link to='/recall-campaigns' />}>
          {t('Back to Activity Configuration')}
        </Button>
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Title>{detail.name}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Badge variant='secondary'>{t(detail.status)}</Badge>
        <Button variant='outline' onClick={() => setPreviewOpen(true)}>
          {t('Preview')}
        </Button>
        <Button variant='outline' onClick={downloadExport}>
          {t('Export CSV')}
        </Button>
        {actionsForStatus(detail.status).map((action) => (
          <Button
            key={action}
            variant={action === 'cancel' ? 'destructive' : 'default'}
            onClick={() => setDialog({ action })}
          >
            {t(action)}
          </Button>
        ))}
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Campaign metrics')}</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <>
                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    {[
                      ['Candidates', metrics.candidate_count],
                      ['Enrolled', metrics.enrolled_count],
                      ['Excluded', metrics.excluded_count],
                      ['Observed clicks', metrics.observed_click_count],
                      ['Direct conversions', metrics.direct_count],
                      ['Assisted conversions', metrics.assisted_count],
                      ['No-coupon conversions', metrics.no_coupon_count],
                      ['Accepted messages', metrics.messages_accepted_count],
                    ].map(([label, value]) => (
                      <div
                        className='rounded-lg border p-3'
                        key={String(label)}
                      >
                        <div className='text-muted-foreground text-xs'>
                          {t(String(label))}
                        </div>
                        <div className='text-xl font-semibold'>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className='mt-4 grid gap-3 md:grid-cols-2'>
                    {metrics.currency_metrics.map((currency) => (
                      <div
                        className='rounded-lg border p-3'
                        key={currency.currency}
                      >
                        <h4 className='font-medium'>
                          {currency.currency.toUpperCase()}
                        </h4>
                        <p>
                          {t('Payment amount')}: {currency.payment_amount}
                        </p>
                        <p>
                          {t('Discount amount')}: {currency.discount_amount}
                        </p>
                        <p>
                          {t('Direct / assisted / no coupon')}:{' '}
                          {currency.direct_count} / {currency.assisted_count} /{' '}
                          {currency.no_coupon_count}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p>{t('Loading')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Recipients and messages')}</CardTitle>
            </CardHeader>
            <CardContent className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Recipient')}</TableHead>
                    <TableHead>{t('Stripe details')}</TableHead>
                    <TableHead>{t('Delivery and conversion')}</TableHead>
                    <TableHead>{t('Messages and errors')}</TableHead>
                    <TableHead>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>
                        <div>#{recipient.id}</div>
                        <div>
                          {t('User ID')}: {recipient.user_id}
                        </div>
                        <Badge variant='outline'>{t(recipient.state)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          {t('Customer ID')}:{' '}
                          {recipient.stripe_customer_id || '-'}
                        </div>
                        <div>
                          {t('Masked code')}:{' '}
                          {recipient.promotion_code_masked || '-'}
                        </div>
                        <div>
                          {t('Expires')}:{' '}
                          {formatTimestamp(recipient.promotion_expires_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {t('Observed click')}:{' '}
                          {formatTimestamp(recipient.clicked_at)}
                        </div>
                        <div>
                          {t('Conversion kind')}:{' '}
                          {recipient.conversion_kind
                            ? t(recipient.conversion_kind)
                            : '-'}
                        </div>
                        <div>
                          {recipient.conversion_currency.toUpperCase()}{' '}
                          {recipient.conversion_amount || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='space-y-1'>
                          {recipient.messages.map((message) => (
                            <div
                              className='rounded border p-2 text-xs'
                              key={message.id}
                            >
                              <div>
                                {t('Stage {{stage}}', {
                                  stage: message.stage_no,
                                })}{' '}
                                · {t(message.state)} · {t('TemplateVersion')}{' '}
                                {message.template_version}
                              </div>
                              <div>
                                {t('Attempts')}: {message.attempt_count}
                              </div>
                              {message.last_error_message ? (
                                <div className='text-destructive'>
                                  {message.last_error_code}:{' '}
                                  {message.last_error_message}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {recipient.last_error_message ? (
                          <p className='text-destructive mt-2'>
                            {recipient.last_error_code}:{' '}
                            {recipient.last_error_message}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {getRecallRecipientRetry(recipient).allowed ? (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => retryRecipient(recipient)}
                          >
                            {t('Retry')}
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className='mt-3 flex items-center justify-end gap-2'>
                <span className='text-muted-foreground text-sm'>
                  {recipientPage} / {recipientPageCount}
                </span>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={recipientPage <= 1}
                  onClick={() => setRecipientPage((page) => page - 1)}
                >
                  {t('Previous')}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={recipientPage >= recipientPageCount}
                  onClick={() => setRecipientPage((page) => page + 1)}
                >
                  {t('Next')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Audit timeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className='space-y-3'>
                {events.map((event) => (
                  <li className='rounded-lg border p-3' key={event.id}>
                    <div className='flex justify-between gap-3'>
                      <strong>{t(event.event_type)}</strong>
                      <span className='text-muted-foreground text-xs'>
                        {formatTimestamp(event.created_at)}
                      </span>
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {event.source} · {event.source_event_id}
                    </div>
                    {event.event_data ? (
                      <pre className='mt-2 overflow-auto text-xs whitespace-pre-wrap'>
                        {event.event_data}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ol>
              <div className='mt-3 flex items-center justify-end gap-2'>
                <span className='text-muted-foreground text-sm'>
                  {eventPage} / {eventPageCount}
                </span>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={eventPage <= 1}
                  onClick={() => setEventPage((page) => page - 1)}
                >
                  {t('Previous')}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={eventPage >= eventPageCount}
                  onClick={() => setEventPage((page) => page + 1)}
                >
                  {t('Next')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <CampaignEditor
            campaignId={detail.id}
            initialDraft={detail.draft}
            status={detail.status}
          />
        </div>
        <CampaignPreviewDialog
          campaignId={props.campaignId}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
        {dialog ? (
          <CampaignActionDialog
            campaignId={props.campaignId}
            action={dialog.action}
            recipientId={dialog.recipientId}
            uncertain={dialog.uncertain}
            open
            onOpenChange={(open) => {
              if (!open) setDialog(null)
            }}
          />
        ) : null}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
