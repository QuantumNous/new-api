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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { updateAutoGroupRule } from '../api'
import { QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import type { AutoGroupRule } from '../types'
import { useRulesDialog } from './rules-provider'

export function useRulesColumns(): ColumnDef<AutoGroupRule>[] {
  const { t } = useTranslation()
  const { setCurrentRow, setOpen } = useRulesDialog()
  const queryClient = useQueryClient()

  const toggleEnabledMutation = useMutation({
    mutationFn: (rule: AutoGroupRule) =>
      updateAutoGroupRule(rule.id, {
        job_title: rule.job_title,
        target_group: rule.target_group,
        enabled: !rule.enabled,
        priority: rule.priority,
        remark: rule.remark,
      }),
    onSuccess: (result, rule) => {
      if (result.success) {
        toast.success(
          rule.enabled
            ? t(SUCCESS_MESSAGES.RULE_DISABLED)
            : t(SUCCESS_MESSAGES.RULE_ENABLED)
        )
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES })
      }
    },
  })

  return [
    {
      accessorKey: 'job_title',
      header: t('Job Title'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('job_title')}</span>
      ),
      size: 200,
    },
    {
      accessorKey: 'target_group',
      header: t('Target Group'),
      cell: ({ row }) => (
        <StatusBadge
          label={row.getValue('target_group')}
          variant='info'
          copyable={false}
          className='-ml-1.5'
        />
      ),
      size: 160,
    },
    {
      accessorKey: 'enabled',
      header: t('Enabled'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const rule = row.original
        return (
          <button
            type='button'
            onClick={() => toggleEnabledMutation.mutate(rule)}
            disabled={toggleEnabledMutation.isPending}
            className='cursor-pointer disabled:cursor-wait'
            aria-label={rule.enabled ? t('Disable') : t('Enable')}
          >
            <StatusBadge
              label={rule.enabled ? t('Enabled') : t('Disabled')}
              variant={rule.enabled ? 'success' : 'neutral'}
              copyable={false}
              className='-ml-1.5'
            />
          </button>
        )
      },
      filterFn: (row, _id, value) => {
        const enabled = row.getValue('enabled') as boolean
        return value.includes(String(enabled))
      },
      size: 110,
    },
    {
      accessorKey: 'priority',
      header: t('Priority'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const priority = row.getValue('priority') as number
        return <span className='font-mono text-sm'>{priority}</span>
      },
      size: 100,
    },
    {
      accessorKey: 'remark',
      header: t('Remark'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const remark = row.getValue('remark') as string
        if (!remark) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <span className='text-muted-foreground text-sm'>{remark}</span>
        )
      },
      size: 200,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => {
        const rule = row.original
        return (
          <div className='-ml-1.5 flex items-center gap-1'>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => {
                      setCurrentRow(rule)
                      setOpen('update')
                    }}
                    aria-label={t('Edit')}
                  />
                }
              >
                <Edit />
              </TooltipTrigger>
              <TooltipContent>{t('Edit')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => {
                      setCurrentRow(rule)
                      setOpen('delete')
                    }}
                    aria-label={t('Delete')}
                  />
                }
              >
                <Trash2 className='text-destructive' />
              </TooltipTrigger>
              <TooltipContent>{t('Delete')}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
      meta: { pinned: 'right' as const },
    },
  ]
}
