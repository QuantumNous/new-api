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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FlaskConical, Loader2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

import {
  approveChannelContribution,
  createAdminChannelContributionTestRun,
  deleteAdminChannelContribution,
  getAdminChannelContribution,
  rejectChannelContribution,
} from '../api'
import {
  formatContributionModelMapping,
  formatContributionTimestamp,
  getContributionName,
  getContributionRevision,
  getContributionTestRun,
  getTestRunId,
  hasPendingContributionRevision,
  isTestRunActive,
  parseContributionModels,
  testRunPassed,
} from '../lib'
import type { ChannelContributionTestRun } from '../types'
import {
  ContributionRevisionStatusBadge,
  ContributionStatusBadge,
} from './contribution-status'
import { ContributionTestMatrix } from './test-matrix'

function DetailValue(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='min-w-0 space-y-1'>
      <dt className='text-muted-foreground text-xs'>{props.label}</dt>
      <dd className='text-sm break-words'>{props.children}</dd>
    </div>
  )
}

export function AdminContributionDetail(props: {
  id: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createdAdminRun, setCreatedAdminRun] =
    useState<ChannelContributionTestRun | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['channel-contributions', 'admin', 'detail', props.id],
    queryFn: async () => {
      const response = await getAdminChannelContribution(props.id)
      if (!response.success || !response.data) {
        throw new Error(response.message || t('Failed to load contribution'))
      }
      return response.data
    },
    enabled: props.open,
    refetchInterval: (query) => {
      const embedded = query.state.data?.latest_test_run
      return isTestRunActive(createdAdminRun) || isTestRunActive(embedded)
        ? 1500
        : false
    },
  })
  const contribution = detailQuery.data
  const revision = getContributionRevision(contribution)
  const pendingReview = hasPendingContributionRevision(contribution)
  const embeddedRun = getContributionTestRun(contribution)
  const createdRunId = getTestRunId(createdAdminRun)
  const embeddedRunId = getTestRunId(embeddedRun)
  let adminRun = createdAdminRun
  if (embeddedRun?.actor_type === 'admin' && !createdAdminRun) {
    adminRun = embeddedRun
  } else if (createdRunId && createdRunId === embeddedRunId) {
    adminRun = embeddedRun
  }

  const testMutation = useMutation({
    mutationFn: createAdminChannelContributionTestRun,
  })
  const approveMutation = useMutation({
    mutationFn: (testRunId: number | string) =>
      approveChannelContribution(props.id, testRunId),
  })
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectChannelContribution(props.id, reason),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminChannelContribution(props.id),
  })

  const refreshLists = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['channel-contributions', 'admin'],
    })
  }

  const handleTest = async () => {
    try {
      const response = await testMutation.mutateAsync(props.id)
      if (!response.success || !response.data) {
        toast.error(response.message || t('Failed to start model tests'))
        return
      }
      setCreatedAdminRun(response.data)
      toast.success(t('Administrator verification started'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to start model tests')
      )
    }
  }

  const handleApprove = async () => {
    const runId = getTestRunId(adminRun)
    if (!runId) return
    try {
      const response = await approveMutation.mutateAsync(runId)
      if (!response.success) {
        toast.error(response.message || t('Failed to approve contribution'))
        return
      }
      await refreshLists()
      props.onOpenChange(false)
      toast.success(t('Contribution approved'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to approve contribution')
      )
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    try {
      const response = await rejectMutation.mutateAsync(rejectReason.trim())
      if (!response.success) {
        toast.error(response.message || t('Failed to reject contribution'))
        return
      }
      setRejectOpen(false)
      await refreshLists()
      props.onOpenChange(false)
      toast.success(t('Contribution rejected'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to reject contribution')
      )
    }
  }

  const handleDelete = async () => {
    try {
      const response = await deleteMutation.mutateAsync()
      if (!response.success) {
        toast.error(response.message || t('Failed to delete contribution'))
        return
      }
      setDeleteOpen(false)
      await refreshLists()
      props.onOpenChange(false)
      toast.success(t('Contribution deleted'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to delete contribution')
      )
    }
  }

  const busy =
    testMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending ||
    isTestRunActive(adminRun)
  const approveReady = pendingReview && testRunPassed(adminRun)

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className='grid max-h-[min(92vh,900px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-4xl'>
          <DialogHeader className='border-b px-4 py-4 sm:px-5'>
            <div className='flex min-w-0 items-center gap-2 pr-8'>
              <DialogTitle className='truncate'>
                {contribution
                  ? getContributionName(contribution)
                  : t('Contribution review')}
              </DialogTitle>
              {contribution ? (
                <>
                  <ContributionStatusBadge status={contribution.status} />
                  {contribution.revision_status === 'pending' &&
                  contribution.status !== 'pending' ? (
                    <ContributionRevisionStatusBadge status='pending' />
                  ) : null}
                </>
              ) : null}
            </div>
            <DialogDescription>
              {t(
                'Run an independent administrator test before approving this revision.'
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className='min-h-0 flex-1'>
            <div className='space-y-6 px-4 py-5 sm:px-5'>
              {detailQuery.isLoading ? (
                <div className='text-muted-foreground flex min-h-48 items-center justify-center text-sm'>
                  <Loader2
                    className='mr-2 size-4 animate-spin'
                    aria-hidden='true'
                  />
                  {t('Loading...')}
                </div>
              ) : null}
              {!detailQuery.isLoading &&
              (detailQuery.error || !contribution || !revision) ? (
                <p className='text-destructive py-8 text-center text-sm'>
                  {detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : t('Contribution details are incomplete')}
                </p>
              ) : null}
              {!detailQuery.isLoading &&
              !detailQuery.error &&
              contribution &&
              revision ? (
                <>
                  <section className='space-y-3'>
                    <h3 className='text-sm font-semibold'>
                      {t('Connection details')}
                    </h3>
                    <dl className='grid gap-4 border-y py-4 sm:grid-cols-2 lg:grid-cols-3'>
                      <DetailValue label={t('Contributor')}>
                        {contribution.username || '-'} · {t('ID')}{' '}
                        {contribution.user_id ?? '-'}
                      </DetailValue>
                      <DetailValue label={t('Channel type')}>
                        {revision.type}
                      </DetailValue>
                      <DetailValue label={t('Group')}>
                        {revision.group}
                      </DetailValue>
                      <DetailValue label={t('API endpoint')}>
                        <span className='font-mono text-xs'>
                          {revision.base_url}
                        </span>
                      </DetailValue>
                      <DetailValue label={t('Revision')}>
                        {revision.revision_number ?? '-'}
                      </DetailValue>
                      <DetailValue label={t('Submitted')}>
                        {formatContributionTimestamp(
                          revision.submitted_at || contribution.submitted_at
                        )}
                      </DetailValue>
                    </dl>
                  </section>

                  <section className='space-y-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <h3 className='text-sm font-semibold'>{t('Models')}</h3>
                      <span className='text-muted-foreground text-xs'>
                        {t('{{count}} models', {
                          count: parseContributionModels(revision.models)
                            .length,
                        })}
                      </span>
                    </div>
                    <div className='flex max-h-36 flex-wrap gap-1.5 overflow-y-auto border-y py-3'>
                      {parseContributionModels(revision.models).map((model) => (
                        <code
                          key={model}
                          className='bg-muted rounded px-1.5 py-0.5 text-xs break-all'
                        >
                          {model}
                        </code>
                      ))}
                    </div>
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs'>
                        {t('Model Mapping')}
                      </p>
                      <pre className='bg-muted max-h-44 overflow-auto rounded-lg p-3 text-xs'>
                        {formatContributionModelMapping(
                          revision.model_mapping
                        ) || '{}'}
                      </pre>
                    </div>
                  </section>

                  {contribution.review_reason ? (
                    <section className='space-y-1 border-y py-3'>
                      <h3 className='text-sm font-semibold'>
                        {t('Review note')}
                      </h3>
                      <p className='text-muted-foreground text-sm break-words'>
                        {contribution.review_reason}
                      </p>
                    </section>
                  ) : null}

                  <section className='space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div>
                        <h3 className='text-sm font-semibold'>
                          {t('Administrator verification')}
                        </h3>
                        <p className='text-muted-foreground text-xs'>
                          {t(
                            'Approval is bound to this administrator test run ID.'
                          )}
                        </p>
                      </div>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled={busy}
                        onClick={handleTest}
                      >
                        {testMutation.isPending || isTestRunActive(adminRun) ? (
                          <Loader2
                            className='animate-spin'
                            data-icon='inline-start'
                          />
                        ) : (
                          <FlaskConical data-icon='inline-start' />
                        )}
                        {t('Run admin test')}
                      </Button>
                    </div>
                    <ContributionTestMatrix run={adminRun} />
                  </section>
                </>
              ) : null}
            </div>
          </ScrollArea>

          <DialogFooter className='grid grid-cols-2 sm:flex'>
            <Button
              type='button'
              variant='destructive'
              className='sm:mr-auto'
              disabled={busy || !contribution}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 data-icon='inline-start' />
              {t('Delete')}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={busy || !pendingReview}
              onClick={() => setRejectOpen(true)}
            >
              <X data-icon='inline-start' />
              {t('Reject')}
            </Button>
            <Button
              type='button'
              disabled={busy || !approveReady}
              onClick={handleApprove}
            >
              <Check data-icon='inline-start' />
              {t('Approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Reject contribution')}</DialogTitle>
            <DialogDescription>
              {t(
                'Give the contributor a clear reason they can address before resubmitting.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='channel-contribution-reject-reason'>
              {t('Rejection reason')}
            </Label>
            <Textarea
              id='channel-contribution-reject-reason'
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              maxLength={500}
              rows={5}
              placeholder={t('Describe what must be corrected')}
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setRejectOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={handleReject}
            >
              {t('Reject contribution')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('Delete channel contribution?')}
        desc={t('The linked contributed channel will be removed from service.')}
        confirmText={t('Delete')}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={handleDelete}
      />
    </>
  )
}
