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
*/
import type { Row } from '@tanstack/react-table'
import { CheckCircle2, Edit, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { updateSlaIncident } from '../api'
import { SLA_INCIDENT_STATUS, SUCCESS_MESSAGES } from '../constants'
import { slaIncidentSchema } from '../types'
import { useSlaIncidents } from './sla-incidents-provider'

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const incident = slaIncidentSchema.parse(row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useSlaIncidents()

  const isResolved = incident.status === SLA_INCIDENT_STATUS.RESOLVED

  const handleResolve = async () => {
    const result = await updateSlaIncident(incident.id, {
      title: incident.title,
      description: incident.description,
      status: SLA_INCIDENT_STATUS.RESOLVED,
      severity: incident.severity,
      started_at: incident.started_at,
      resolved_at: Math.floor(Date.now() / 1000),
    })
    if (result.success) {
      toast.success(t(SUCCESS_MESSAGES.SLA_INCIDENT_RESOLVED))
      triggerRefresh()
    }
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setCurrentRow(incident)
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

      <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
        {!isResolved && (
          <DropdownMenuItem onClick={handleResolve}>
            {t('Resolve')}
            <DropdownMenuShortcut>
              <CheckCircle2 size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        {!isResolved && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(incident)
            setOpen('delete')
          }}
          className='text-destructive focus:text-destructive'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
