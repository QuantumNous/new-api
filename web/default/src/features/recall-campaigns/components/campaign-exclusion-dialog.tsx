import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  confirmRecallCampaignExclusionBatch,
  getRecallCampaignExclusionBatch,
  previewRecallCampaignExclusions,
  recallCampaignKeys,
} from '../api'
import type { RecallExclusionPreview } from '../types'

interface CampaignExclusionDialogProps {
  campaignId: number
  initialBatchId?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

function resetFileInput(input: HTMLInputElement | null) {
  if (input) input.value = ''
}

function problemKey(problem: { row: number; code: string; message: string }) {
  return `${problem.row}:${problem.code}:${problem.message}`
}

const exclusionProblemCopyKeyByCode: Record<string, string> = {
  malformed_user_id: 'User ID must be a positive integer.',
  malformed_email: 'Email must be valid.',
  missing_identity: 'Row has no user ID or email.',
  unknown_user: 'Identity did not resolve to an existing user.',
  identity_conflict: 'User ID and email resolve to different users.',
  duplicate_identity: 'Duplicate CSV row ignored.',
  stored_blocking_errors: 'Batch contains blocking errors from preview.',
  duplicate_email: 'Duplicate CSV row ignored.',
  campaign_member: 'User is already enrolled in this campaign.',
  already_converted: 'Row conflicts with a converted recipient.',
}

function getExclusionProblemCopyKey(problem: {
  code: string
  message: string
}): string {
  return exclusionProblemCopyKeyByCode[problem.code] ?? problem.message
}

export function CampaignExclusionDialog(
  props: CampaignExclusionDialogProps
): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedFileRef = useRef<File | null>(null)
  const dialogGenerationRef = useRef(0)
  const previousOpenRef = useRef(props.open)
  const previewRequestIdRef = useRef(0)
  const activePreviewRequestRef = useRef<number | null>(null)
  const [preview, setPreview] = useState<RecallExclusionPreview | null>(null)
  const [error, setError] = useState('')
  const [locallyClosed, setLocallyClosed] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [successPreview, setSuccessPreview] =
    useState<RecallExclusionPreview | null>(null)
  const [confirmedBatchIds, setConfirmedBatchIds] = useState<Set<number>>(
    () => new Set()
  )
  const batchQueryKey = [
    'recall-campaigns',
    props.campaignId,
    'exclusion-batch',
    props.initialBatchId,
  ]
  const batchQuery = useQuery({
    queryKey: batchQueryKey,
    queryFn: () =>
      getRecallCampaignExclusionBatch(
        props.campaignId,
        props.initialBatchId ?? 0
      ),
    enabled: props.open && typeof props.initialBatchId === 'number',
    staleTime: Infinity,
  })
  const confirmMutation = useMutation({
    mutationFn: (batchId: number) =>
      confirmRecallCampaignExclusionBatch(props.campaignId, batchId),
  })
  useEffect(() => {
    if (props.open && !previousOpenRef.current) {
      setLocallyClosed(false)
    }
    previousOpenRef.current = props.open
  }, [props.open])
  const batchPreview = batchQuery.data?.data ?? null
  const recoveredPreview =
    typeof props.initialBatchId === 'number' &&
    (confirmedBatchIds.has(props.initialBatchId) ||
      batchPreview?.confirmable === false)
      ? null
      : batchPreview
  const visiblePreview = locallyClosed
    ? null
    : (preview ?? (successPreview ? null : recoveredPreview))

  const clearRawState = () => {
    selectedFileRef.current = null
    resetFileInput(fileInputRef.current)
  }

  const previewFile = async () => {
    if (activePreviewRequestRef.current !== null) return
    const file = selectedFileRef.current ?? fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Choose a CSV file before previewing exclusions.')
      return
    }
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    activePreviewRequestRef.current = requestId
    setLocallyClosed(false)
    setError('')
    setSuccessPreview(null)
    setPreviewPending(true)
    clearRawState()
    try {
      const response = await previewRecallCampaignExclusions(
        props.campaignId,
        file
      )
      if (previewRequestIdRef.current === requestId) {
        setPreview(response.data ?? null)
      }
    } catch (_error) {
      if (previewRequestIdRef.current === requestId) {
        setError('Unable to preview exclusions.')
        setPreview(null)
      }
    } finally {
      if (previewRequestIdRef.current === requestId) {
        activePreviewRequestRef.current = null
        setPreviewPending(false)
      }
    }
  }

  const confirm = async () => {
    if (!visiblePreview?.confirmable) return
    const dialogGeneration = dialogGenerationRef.current
    setLocallyClosed(false)
    setError('')
    try {
      const response = await confirmMutation.mutateAsync(
        visiblePreview.batch_id
      )
      const confirmedPreview = {
        ...(response.data ?? visiblePreview),
        confirmable: false,
      }
      queryClient.setQueryData(batchQueryKey, {
        success: true,
        data: confirmedPreview,
      })
      await queryClient.invalidateQueries({
        queryKey: recallCampaignKeys.metrics(props.campaignId),
      })
      await queryClient.invalidateQueries({
        queryKey: recallCampaignKeys.detail(props.campaignId),
      })
      await queryClient.invalidateQueries({
        queryKey: batchQueryKey,
        refetchType: 'none',
      })
      queryClient.setQueryData(batchQueryKey, {
        success: true,
        data: confirmedPreview,
      })
      if (dialogGenerationRef.current !== dialogGeneration) return
      setSuccessPreview(confirmedPreview)
      setConfirmedBatchIds((current) => {
        const next = new Set(current)
        next.add(visiblePreview.batch_id)
        return next
      })
      setPreview(null)
      clearRawState()
    } catch (_error) {
      if (dialogGenerationRef.current !== dialogGeneration) return
      setError('Unable to apply exclusions.')
      clearRawState()
    }
  }

  const close = () => {
    dialogGenerationRef.current += 1
    previewRequestIdRef.current += 1
    activePreviewRequestRef.current = null
    clearRawState()
    setLocallyClosed(true)
    setError('')
    setPreview(null)
    setSuccessPreview(null)
    setPreviewPending(false)
    props.onOpenChange(false)
  }

  const retryBatchLoad = () => {
    void batchQuery.refetch()
  }

  const problems = visiblePreview
    ? [...visiblePreview.blocking_errors, ...visiblePreview.warnings]
    : []
  const visibleProblems = problems.slice(0, 20)
  const hiddenProblemCount = problems.length - visibleProblems.length

  return (
    <Dialog open={props.open} onOpenChange={(open) => (!open ? close() : null)}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{t('Exclude campaign users')}</DialogTitle>
          <DialogDescription>
            {t('Preview the CSV before applying exclusions.')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-1'>
            <Label htmlFor='recall-exclusion-file'>{t('CSV file')}</Label>
            <Input
              id='recall-exclusion-file'
              ref={fileInputRef}
              type='file'
              accept='.csv,text/csv'
              onChange={(event) => {
                setLocallyClosed(false)
                selectedFileRef.current = event.target.files?.[0] ?? null
                setError('')
              }}
            />
          </div>
          <Button
            type='button'
            disabled={previewPending}
            onClick={() => void previewFile()}
          >
            {t('Preview exclusions')}
          </Button>
          {error ? (
            <p role='alert' className='text-destructive text-sm'>
              {t(error)}
            </p>
          ) : null}
          {batchQuery.isError ? (
            <div role='alert' className='text-destructive space-y-2 text-sm'>
              <p>{t('Unable to load exclusion batch.')}</p>
              <Button type='button' variant='outline' onClick={retryBatchLoad}>
                {t('Retry')}
              </Button>
            </div>
          ) : null}
          {successPreview ? (
            <div role='status' className='rounded-lg border p-3 text-sm'>
              <div>{t('Exclusions applied.')}</div>
              <div>
                {t('{{count}} queued messages were canceled', {
                  count: successPreview.cancelable_work,
                })}
              </div>
            </div>
          ) : null}
          {visiblePreview ? (
            <div className='space-y-3 rounded-lg border p-3'>
              <div className='grid gap-2 text-sm sm:grid-cols-2'>
                <div>
                  {t('{{count}} total rows', {
                    count: visiblePreview.total_rows,
                  })}
                </div>
                <div>
                  {t('{{count}} resolved users', {
                    count: visiblePreview.resolved_users,
                  })}
                </div>
                <div>
                  {t('{{count}} duplicate rows', {
                    count: visiblePreview.duplicate_rows,
                  })}
                </div>
                <div>
                  {t('{{count}} unresolved rows', {
                    count: visiblePreview.unresolved_rows,
                  })}
                </div>
                <div>
                  {t('{{count}} conflict rows', {
                    count: visiblePreview.conflict_rows,
                  })}
                </div>
                <div>
                  {t('{{count}} queued messages can be canceled', {
                    count: visiblePreview.cancelable_work,
                  })}
                </div>
              </div>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Confirming will exclude resolved users and cancel pending campaign work that is still cancelable.'
                )}
              </p>
              {visibleProblems.length > 0 ? (
                <ul className='space-y-1 text-sm'>
                  {visibleProblems.map((problem) => (
                    <li key={problemKey(problem)}>
                      {t('Row {{row}}', { row: problem.row })}:{' '}
                      {t(getExclusionProblemCopyKey(problem))}
                    </li>
                  ))}
                  {hiddenProblemCount > 0 ? (
                    <li>
                      {t('{{count}} more problems not shown', {
                        count: hiddenProblemCount,
                      })}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={close}>
            {t('Close')}
          </Button>
          <Button
            type='button'
            disabled={
              !visiblePreview?.confirmable ||
              Boolean(successPreview) ||
              previewPending ||
              confirmMutation.isPending
            }
            onClick={() => void confirm()}
          >
            {t('Apply exclusions')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
