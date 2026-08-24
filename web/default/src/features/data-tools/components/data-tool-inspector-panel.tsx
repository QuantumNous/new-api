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
import { MousePointerClick, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DataToolSummary } from '../types'
import { DataToolRunner } from './data-tool-runner'

type DataToolInspectorPanelProps = {
  tool: DataToolSummary | null
  onClose: () => void
}

export function DataToolInspectorPanel(props: DataToolInspectorPanelProps) {
  const { t } = useTranslation()

  if (!props.tool) {
    return (
      <aside className='bg-card/50 text-muted-foreground sticky top-3 flex min-h-72 items-center justify-center rounded-3xl border border-dashed p-8 text-center'>
        <div className='max-w-56'>
          <MousePointerClick className='mx-auto mb-3 size-6 opacity-60' />
          <p className='text-sm leading-6'>
            {t('Select an endpoint to inspect and test it.')}
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside className='bg-card/75 sticky top-3 max-h-[calc(100vh-8rem)] overflow-auto rounded-3xl border p-5 shadow-xl backdrop-blur'>
      <div className='mb-5 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='mb-2 flex flex-wrap items-center gap-2'>
            <Badge variant='outline'>{props.tool.platform}</Badge>
            {props.tool.isNew && <Badge>{t('NEW')}</Badge>}
          </div>
          <h3 className='text-lg leading-tight font-semibold'>
            {props.tool.name}
          </h3>
          <p className='text-muted-foreground mt-2 text-sm leading-5'>
            {props.tool.description}
          </p>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {props.tool.id}
          </p>
        </div>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          aria-label={t('Close')}
          onClick={props.onClose}
        >
          <X />
        </Button>
      </div>

      <DataToolRunner tool={props.tool} compact />
    </aside>
  )
}
