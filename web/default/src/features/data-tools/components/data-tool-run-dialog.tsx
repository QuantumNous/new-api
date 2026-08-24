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
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DataToolSummary } from '../types'
import { DataToolRunner } from './data-tool-runner'

type DataToolRunDialogProps = {
  tool: DataToolSummary | null
  onClose: () => void
}

export function DataToolRunDialog(props: DataToolRunDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={props.tool !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <div className='flex flex-wrap items-center gap-2'>
            <DialogTitle>{props.tool?.name ?? t('Data tool')}</DialogTitle>
            {props.tool?.isNew && <Badge>{t('NEW')}</Badge>}
          </div>
          <DialogDescription>
            {props.tool?.description ?? t('Inspect and run this data tool.')}
          </DialogDescription>
        </DialogHeader>

        {props.tool && <DataToolRunner key={props.tool.id} tool={props.tool} />}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
