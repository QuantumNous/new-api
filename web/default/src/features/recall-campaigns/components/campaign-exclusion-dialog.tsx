import { useRef, useState } from 'react'
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

export function CampaignExclusionDialog(
  props: CampaignExclusionDialogProps
): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedFileRef = useRef<File | null>(null)
  const [preview, setPreview] = useState<RecallExclusionPreview | null>(null)
  const [error, setError] = useState('')
  const [previewPending, setPreviewPending] = useState(false)
  const [successPreview, setSuccessPreview] =
    useState<RecallExclusionPreview | null>(null)
  const batchQuery = useQuery({
    queryKey: [
      'recall-campaigns',
      props.campaignId,
      'exclusion-batch',
      props.initialBatchId,
    ],
    queryFn: () =>
      getRecallCampaignExclusionBatch(
        props.campaignId,
        props.initialBatchId ?? 0
      ),
    enabled: props.open && typeof props.initialBatchId === 'number',
  })
  const confirmMutation = useMutation({
    mutationFn: (batchId: number) =>
      confirmRecallCampaignExclusionBatch(props.campaignId, batchId),
  })

  const visiblePreview = preview ?? batchQuery.data?.data ?? null

  const clearRawState = () => {
    selectedFileRef.current = null
    resetFileInput(fileInputRef.current)
  }

  const previewFile = async () => {
    const file = selectedFileRef.current ?? fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Choose a CSV file before previewing exclusions.')
      return
    }
    setError('')
    setSuccessPreview(null)
    setPreviewPending(true)
    try {
      const response = await previewRecallCampaignExclusions(
        props.campaignId,
        file
      )
      setPreview(response.data ?? null)
    } catch (_error) {
      setError('Unable to preview exclusions.')
      setPreview(null)
    } finally {
      clearRawState()
      setPreviewPending(false)
    }
  }

  const confirm = async () => {
    if (!visiblePreview?.confirmable) return
    const response = await confirmMutation.mutateAsync(visiblePreview.batch_id)
    setSuccessPreview(response.data ?? visiblePreview)
    setPreview(null)
    clearRawState()
    await queryClient.invalidateQueries({
      queryKey: recallCampaignKeys.metrics(props.campaignId),
    })
    await queryClient.invalidateQueries({
      queryKey: recallCampaignKeys.detail(props.campaignId),
    })
  }

  const close = () => {
    clearRawState()
    setError('')
    setPreview(null)
    setSuccessPreview(null)
    props.onOpenChange(false)
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
          {successPreview ? (
            <div role='status' className='rounded-lg border p-3 text-sm'>
              <div>{t('Exclusions applied.')}</div>
              <div>
                {t('{{count}} queued messages were cancelable', {
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
                      {t(problem.message)}
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
