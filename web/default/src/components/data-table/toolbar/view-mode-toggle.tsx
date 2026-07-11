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
import { Grid2X2, Table2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger } from '@/components/design-system/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  DATA_TABLE_VIEW_MODES,
  type DataTableViewMode,
} from '../hooks/use-data-table-view-mode'

export type DataTableViewModeToggleProps = {
  value: DataTableViewMode
  onChange: (mode: DataTableViewMode) => void
  className?: string
}

/**
 * Reusable icon segmented control for switching a data table between table and
 * card views. Shared, accessible version of the local control used by the
 * model square (`pricing-toolbar.tsx`).
 */
export function DataTableViewModeToggle(props: DataTableViewModeToggleProps) {
  const { t } = useTranslation()

  return (
    <Tabs
      value={props.value}
      onValueChange={(value) => props.onChange(value as DataTableViewMode)}
      className={props.className}
    >
      <TabsList aria-label={t('View mode')}>
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTrigger
                value={DATA_TABLE_VIEW_MODES.TABLE}
                className='px-2'
              />
            }
          >
            <Table2 aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>{t('Table view')}</span>
          </TooltipTrigger>
          <TooltipContent side='bottom'>{t('Table view')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTrigger
                value={DATA_TABLE_VIEW_MODES.CARD}
                className='px-2'
              />
            }
          >
            <Grid2X2 aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>{t('Card view')}</span>
          </TooltipTrigger>
          <TooltipContent side='bottom'>{t('Card view')}</TooltipContent>
        </Tooltip>
      </TabsList>
    </Tabs>
  )
}
