import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getInvitationRebateRecordDetail,
  getInvitationRebateRecords,
} from '../api'
import { SettingsSection } from '../components/settings-section'

type Filters = {
  inviterUserId: string
  inviteeUserId: string
  sourceKey: string
  status: string
}

const PAGE_SIZE = 10

function formatRebateStatus(status: string, t: (key: string) => string) {
  if (status === 'success') return t('Success')
  return status
}

function formatRebatePercentage(ratioBps: number) {
  const percent = ratioBps / 100
  const formatted = Number.isInteger(percent)
    ? percent.toFixed(0)
    : percent.toFixed(2).replace(/\.?0+$/, '')
  return `${formatted}%`
}

function positiveNumberOrUndefined(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined
  return parsed
}

export function InvitationRebateRecordsSection() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    inviterUserId: '',
    inviteeUserId: '',
    sourceKey: '',
    status: '',
  })
  const [detailRecordId, setDetailRecordId] = useState<number | null>(null)

  const queryParams = useMemo(
    () => ({
      p: page,
      page_size: PAGE_SIZE,
      inviter_user_id: positiveNumberOrUndefined(filters.inviterUserId),
      invitee_user_id: positiveNumberOrUndefined(filters.inviteeUserId),
      source_key: filters.sourceKey.trim() || undefined,
      status: filters.status || undefined,
    }),
    [filters, page]
  )

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['invitation-rebate-records', queryParams, t],
    queryFn: async () => {
      const result = await getInvitationRebateRecords(queryParams)
      if (!result.success) {
        toast.error(
          result.message || t('Failed to load invitation rebate records')
        )
      }
      return result.data
    },
  })

  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['invitation-rebate-record-detail', detailRecordId, t],
    enabled: detailRecordId !== null,
    queryFn: async () => {
      const result = await getInvitationRebateRecordDetail(detailRecordId!)
      if (!result.success) {
        toast.error(
          result.message || t('Failed to load invitation rebate record detail')
        )
      }
      return result.data
    },
  })

  const records = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  function resetFilters() {
    setFilters({
      inviterUserId: '',
      inviteeUserId: '',
      sourceKey: '',
      status: '',
    })
    setPage(1)
  }

  return (
    <SettingsSection
      title={t('Invitation Rebate Records')}
      description={t(
        "Read-only cumulative settlement records based on invited users' actual consumption."
      )}
    >
      <div className='space-y-3'>
        <div className='grid gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]'>
          <Input
            type='number'
            min={1}
            value={filters.inviterUserId}
            onChange={(event) =>
              updateFilter('inviterUserId', event.currentTarget.value)
            }
            placeholder={t('Inviter User ID')}
          />
          <Input
            type='number'
            min={1}
            value={filters.inviteeUserId}
            onChange={(event) =>
              updateFilter('inviteeUserId', event.currentTarget.value)
            }
            placeholder={t('Invitee User ID')}
          />
          <Input
            value={filters.sourceKey}
            onChange={(event) =>
              updateFilter('sourceKey', event.currentTarget.value)
            }
            placeholder={t('Source Key')}
          />
          <NativeSelect
            className='w-full'
            value={filters.status}
            onChange={(event) =>
              updateFilter('status', event.currentTarget.value)
            }
            aria-label={t('Status')}
          >
            <NativeSelectOption value=''>{t('All Status')}</NativeSelectOption>
            <NativeSelectOption value='success'>
              {t('Success')}
            </NativeSelectOption>
          </NativeSelect>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={resetFilters}>
              {t('Reset')}
            </Button>
            <Button
              variant='outline'
              size='icon'
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label={t('Refresh')}
            >
              <RefreshCcw className={isFetching ? 'animate-spin' : undefined} />
            </Button>
          </div>
        </div>

        <div className='overflow-hidden rounded-lg border'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t('Inviter User ID')}</TableHead>
                  <TableHead>{t('Invitee User ID')}</TableHead>
                  <TableHead>{t('Source Type')}</TableHead>
                  <TableHead>{t('Source Key')}</TableHead>
                  <TableHead>{t('Request ID')}</TableHead>
                  <TableHead>{t('Source Quota')}</TableHead>
                  <TableHead>{t('Rebate Quota')}</TableHead>
                  <TableHead>{t('Rebate Percentage')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Created At')}</TableHead>
                  <TableHead>{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className='text-muted-foreground h-24 text-center'
                    >
                      {t('Loading...')}
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className='text-muted-foreground h-24 text-center'
                    >
                      {t('No invitation rebate records found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className='font-mono text-xs'>
                        #{record.id}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {record.inviter_user_id}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {record.invitee_user_id}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {record.source_type}
                      </TableCell>
                      <TableCell className='max-w-[220px] truncate font-mono text-xs'>
                        {record.source_key}
                      </TableCell>
                      <TableCell className='max-w-[180px] truncate font-mono text-xs'>
                        {record.source_request_id || '-'}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {formatQuota(record.source_quota)}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {formatQuota(record.rebate_quota)}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {formatRebatePercentage(record.rebate_ratio_bps)}
                      </TableCell>
                      <TableCell>
                        <Badge variant='secondary'>
                          {formatRebateStatus(record.status, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {formatTimestampToDate(record.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setDetailRecordId(record.id)}
                        >
                          {t('Details')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-muted-foreground text-sm'>
            {t('Total')}: {total}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground min-w-24 text-center text-sm'>
              {t('Page {{current}} of {{total}}', {
                current: page,
                total: totalPages,
              })}
            </span>
            <Button
              variant='outline'
              disabled={page >= totalPages || isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </div>
      <Dialog
        open={detailRecordId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRecordId(null)
        }}
      >
        <DialogContent className='max-w-[96vw] sm:max-w-[960px]'>
          <DialogHeader>
            <DialogTitle>
              {t('Invitation Rebate Settlement Detail')}
            </DialogTitle>
            <DialogDescription>
              {detailData?.legacy
                ? t(
                    'Legacy rebate records only retain the trigger source key and do not include settlement item details.'
                  )
                : t(
                    'Each row shows one consumed request included in this cumulative rebate settlement.'
                  )}
            </DialogDescription>
          </DialogHeader>
          <div className='max-h-[60vh] overflow-auto rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t('Source Key')}</TableHead>
                  <TableHead>{t('Request ID')}</TableHead>
                  <TableHead>{t('Settled Source Quota')}</TableHead>
                  <TableHead>{t('Rebate Percentage')}</TableHead>
                  <TableHead>{t('Rebate Quota')}</TableHead>
                  <TableHead>{t('Remainder Before')}</TableHead>
                  <TableHead>{t('Remainder After')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDetailLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='text-muted-foreground h-20 text-center'
                    >
                      {t('Loading...')}
                    </TableCell>
                  </TableRow>
                ) : (detailData?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='text-muted-foreground h-20 text-center'
                    >
                      {t('No settlement item details found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  detailData!.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='font-mono text-xs'>
                        #{item.id}
                      </TableCell>
                      <TableCell className='max-w-[220px] truncate font-mono text-xs'>
                        {item.source_key}
                      </TableCell>
                      <TableCell className='max-w-[180px] truncate font-mono text-xs'>
                        {item.source_request_id || '-'}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {formatQuota(item.settled_source_quota)}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {formatRebatePercentage(item.rebate_ratio_bps)}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {formatQuota(item.rebate_quota)}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {item.remainder_before}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {item.remainder_after}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
