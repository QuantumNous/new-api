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
  const previewMutation = useMutation({
    mutationFn: (file: File) =>
      previewRecallCampaignExclusions(props.campaignId, file),
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
    const response = await previewMutation.mutateAsync(file)
    setPreview(response.data ?? null)
    clearRawState()
  }

  const confirm = async () => {
    if (!visiblePreview?.confirmable) return
    const response = await confirmMutation.mutateAsync(visiblePreview.batch_id)
    setPreview(response.data ?? visiblePreview)
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
    props.onOpenChange(false)
  }

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
            disabled={previewMutation.isPending}
            onClick={() => void previewFile()}
          >
            {t('Preview exclusions')}
          </Button>
          {error ? (
            <p role='alert' className='text-destructive text-sm'>
              {t(error)}
            </p>
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
              {[...visiblePreview.blocking_errors, ...visiblePreview.warnings]
                .length > 0 ? (
                <ul className='space-y-1 text-sm'>
                  {[
                    ...visiblePreview.blocking_errors,
                    ...visiblePreview.warnings,
                  ].map((problem) => (
                    <li key={problemKey(problem)}>
                      {t('Row {{row}}', { row: problem.row })}:{' '}
                      {problem.message}
                    </li>
                  ))}
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
              previewMutation.isPending ||
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
