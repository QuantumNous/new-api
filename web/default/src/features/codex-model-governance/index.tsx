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
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RotateCcw, ShieldAlert, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  codexModelGovernanceQueryKeys,
  getCodexModelGovernanceRecords,
  reviewCodexModelGovernanceRecord,
} from './api'
import type {
  CodexModelGovernanceRecord,
  CodexModelGovernanceReviewAction,
} from './types'

const PENDING_STATUS = 'unsupported_pending_review' as const

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

const formatChannelIds = (channelIds: number[]): string => {
  if (channelIds.length === 0) return '-'
  return channelIds.map((id) => `#${id}`).join(', ')
}

type ReviewActionButton = {
  action: CodexModelGovernanceReviewAction
  label: string
  variant: 'default' | 'outline' | 'secondary' | 'destructive'
  icon: typeof CheckCircle2
}

type GovernanceReviewRowProps = {
  record: CodexModelGovernanceRecord
  note: string
  pendingAction?: CodexModelGovernanceReviewAction
  onNoteChange: (id: number, note: string) => void
  onReview: (
    record: CodexModelGovernanceRecord,
    action: CodexModelGovernanceReviewAction
  ) => void
}

function GovernanceReviewRow(props: GovernanceReviewRowProps) {
  const { t } = useTranslation()
  const actionButtons: ReviewActionButton[] = [
    {
      action: 'confirm_remove',
      label: t('Confirm removal'),
      variant: 'destructive',
      icon: XCircle,
    },
    {
      action: 'restore',
      label: t('Restore model'),
      variant: 'default',
      icon: RotateCcw,
    },
    {
      action: 'ignore',
      label: t('Ignore finding'),
      variant: 'outline',
      icon: CheckCircle2,
    },
  ]

  return (
    <TableRow>
      <TableCell className='min-w-64 align-top whitespace-normal'>
        <div className='space-y-2'>
          <div className='font-medium'>{props.record.model_name}</div>
          <div className='text-muted-foreground text-xs'>
            {t('Source')}: {props.record.source || '-'}
          </div>
          {props.record.matched_rule ? (
            <div className='text-muted-foreground text-xs break-all'>
              {t('Matched rule')}: {props.record.matched_rule}
            </div>
          ) : null}
          {props.record.last_error ? (
            <div className='text-destructive text-xs break-words'>
              {props.record.last_error}
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell className='align-top'>
        <Badge variant='secondary'>{t(props.record.status)}</Badge>
      </TableCell>
      <TableCell className='min-w-40 align-top whitespace-normal'>
        {formatChannelIds(props.record.affected_channel_ids)}
      </TableCell>
      <TableCell className='min-w-44 align-top'>
        {formatTimestamp(props.record.detected_at)}
      </TableCell>
      <TableCell className='min-w-64 align-top'>
        <Textarea
          aria-label={t('Review note')}
          className='min-h-20 resize-y'
          value={props.note}
          onChange={(event) =>
            props.onNoteChange(props.record.id, event.target.value)
          }
          placeholder={t('Add a review note')}
        />
      </TableCell>
      <TableCell className='min-w-44 align-top'>
        <div className='flex flex-col gap-2'>
          {actionButtons.map((actionButton) => {
            const Icon = actionButton.icon
            const isPending = props.pendingAction === actionButton.action
            return (
              <Button
                key={actionButton.action}
                size='sm'
                variant={actionButton.variant}
                disabled={Boolean(props.pendingAction)}
                onClick={() =>
                  props.onReview(props.record, actionButton.action)
                }
              >
                <Icon className='h-4 w-4' />
                {isPending ? t('Processing') : actionButton.label}
              </Button>
            )
          })}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function CodexModelGovernance() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [notesById, setNotesById] = useState<Record<number, string>>({})
  const [pendingReview, setPendingReview] = useState<{
    id: number
    action: CodexModelGovernanceReviewAction
  } | null>(null)

  const listParams = { status: PENDING_STATUS }
  const recordsQuery = useQuery({
    queryKey: codexModelGovernanceQueryKeys.list(listParams),
    queryFn: () => getCodexModelGovernanceRecords(listParams),
  })

  const reviewMutation = useMutation({
    mutationFn: (variables: {
      record: CodexModelGovernanceRecord
      action: CodexModelGovernanceReviewAction
    }) =>
      reviewCodexModelGovernanceRecord(variables.record.id, {
        action: variables.action,
        note: notesById[variables.record.id] ?? '',
      }),
    onMutate: (variables) => {
      setPendingReview({
        id: variables.record.id,
        action: variables.action,
      })
    },
    onSuccess: () => {
      toast.success(t('Review saved'))
      void queryClient.invalidateQueries({
        queryKey: codexModelGovernanceQueryKeys.all,
      })
    },
    onSettled: () => {
      setPendingReview(null)
    },
  })

  const records = recordsQuery.data?.data ?? []
  const isLoading = recordsQuery.isLoading || recordsQuery.isFetching

  const handleNoteChange = (id: number, note: string) => {
    setNotesById((current) => ({
      ...current,
      [id]: note,
    }))
  }

  const handleReview = (
    record: CodexModelGovernanceRecord,
    action: CodexModelGovernanceReviewAction
  ) => {
    reviewMutation.mutate({ record, action })
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Codex model governance')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ShieldAlert className='h-5 w-5' />
              {t('Pending review')}
            </CardTitle>
            <CardDescription>
              {t('Unsupported Codex model findings waiting for admin review.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recordsQuery.isError ? (
              <div className='text-destructive text-sm'>
                {t('Failed to load governance records')}
              </div>
            ) : null}

            {!recordsQuery.isError && isLoading && records.length === 0 ? (
              <div className='text-muted-foreground py-8 text-center text-sm'>
                {t('Loading')}
              </div>
            ) : null}

            {!recordsQuery.isError && !isLoading && records.length === 0 ? (
              <div className='text-muted-foreground py-8 text-center text-sm'>
                {t('No pending Codex model governance records.')}
              </div>
            ) : null}

            {records.length > 0 ? (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Model')}</TableHead>
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead>{t('Affected channels')}</TableHead>
                      <TableHead>{t('Detected time')}</TableHead>
                      <TableHead>{t('Review note')}</TableHead>
                      <TableHead>{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <GovernanceReviewRow
                        key={record.id}
                        record={record}
                        note={notesById[record.id] ?? record.review_note ?? ''}
                        pendingAction={
                          pendingReview?.id === record.id
                            ? pendingReview.action
                            : undefined
                        }
                        onNoteChange={handleNoteChange}
                        onReview={handleReview}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
