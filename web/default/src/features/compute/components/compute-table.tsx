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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  computeQueryKeys,
  getComputeNodes,
  stopComputeNode,
} from '../api'
import {
  COMPUTE_ERROR_MESSAGES,
  COMPUTE_STATUS_CONFIG,
  COMPUTE_SUCCESS_MESSAGES,
} from '../constants'
import type { ComputeNode } from '../types'
import { ComputeStatsRow } from './compute-stats'

function StatusBadge(props: { status: ComputeNode['status'] }) {
  const { t } = useTranslation()
  const config =
    COMPUTE_STATUS_CONFIG[props.status] ?? COMPUTE_STATUS_CONFIG.error
  return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>
}

export function ComputeTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pendingStop, setPendingStop] = useState<ComputeNode | null>(null)

  const query = useQuery({
    queryKey: computeQueryKeys.nodes(),
    queryFn: getComputeNodes,
  })

  const stopMutation = useMutation({
    mutationFn: (id: number) => stopComputeNode(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t(COMPUTE_SUCCESS_MESSAGES.STOPPED))
        queryClient.invalidateQueries({ queryKey: computeQueryKeys.nodes() })
      } else {
        toast.error(result.message || t(COMPUTE_ERROR_MESSAGES.STOP_FAILED))
      }
      setPendingStop(null)
    },
    onError: () => {
      toast.error(t(COMPUTE_ERROR_MESSAGES.STOP_FAILED))
      setPendingStop(null)
    },
  })

  const data = query.data?.data
  const nodes = data?.items ?? []

  return (
    <div className='flex flex-col gap-4'>
      <ComputeStatsRow stats={data?.stats} />

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Label')}</TableHead>
              <TableHead>{t('GPU')}</TableHead>
              <TableHead>{t('Cost per hour')}</TableHead>
              <TableHead>{t('Model served')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={`skeleton-cell-${i}-${j}`}>
                      <Skeleton className='h-5 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : query.isError ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-destructive py-8 text-center'
                >
                  {t(COMPUTE_ERROR_MESSAGES.LOAD_FAILED)}
                </TableCell>
              </TableRow>
            ) : nodes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('No compute nodes yet')}
                </TableCell>
              </TableRow>
            ) : (
              nodes.map((node) => (
                <TableRow key={node.id}>
                  <TableCell className='font-medium'>{node.label}</TableCell>
                  <TableCell>{node.gpu_name}</TableCell>
                  <TableCell className='tabular-nums'>
                    ${node.cost_per_hour.toFixed(2)}
                  </TableCell>
                  <TableCell>{node.model_served}</TableCell>
                  <TableCell>
                    <StatusBadge status={node.status} />
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={node.status !== 'running'}
                      onClick={() => setPendingStop(node)}
                    >
                      {t('Stop')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingStop !== null}
        onOpenChange={(open) => !open && setPendingStop(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Stop compute node?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will stop the compute node')}{' '}
              <span className='font-semibold'>{pendingStop?.label}</span>
              {t('. It will stop serving traffic.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stopMutation.isPending}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStop) {
                  stopMutation.mutate(pendingStop.id)
                }
              }}
              disabled={stopMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {stopMutation.isPending ? t('Stopping...') : t('Stop')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
