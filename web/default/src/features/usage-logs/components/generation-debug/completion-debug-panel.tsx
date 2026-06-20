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

import { StatusBadge } from '@/components/status-badge'
import { Label } from '@/components/ui/label'

import { JsonViewer } from './json-viewer'
import type { CompletionDebugData, GenerationDebugRawValue } from './types'
import { finishReasonLabel } from './utils'

interface CompletionDebugPanelProps {
  completion: CompletionDebugData | undefined
  rawResponse: GenerationDebugRawValue | undefined
}

export function CompletionDebugPanel(props: CompletionDebugPanelProps) {
  const { t } = useTranslation()

  if (!props.completion && !props.rawResponse) {
    return (
      <p className='text-muted-foreground text-xs'>{t('No completion data')}</p>
    )
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      {props.completion && (
        <div className='flex flex-wrap gap-2'>
          {props.completion.finish_reason && (
            <StatusBadge
              label={`${t('Finish Reason')}: ${finishReasonLabel(props.completion.finish_reason, t)}`}
              variant='neutral'
              size='sm'
              copyable={false}
            />
          )}
          {props.completion.generation_id && (
            <StatusBadge
              label={`${t('Generation ID')}: ${props.completion.generation_id}`}
              variant='blue'
              size='sm'
            />
          )}
          {props.completion.truncated && (
            <StatusBadge
              label={t('Truncated')}
              variant='orange'
              size='sm'
              copyable={false}
            />
          )}
        </div>
      )}

      {props.completion?.normalized_output && (
        <div className='flex min-w-0 flex-col gap-1.5'>
          <Label>{t('LLM output')}</Label>
          <div className='bg-muted/30 max-h-80 min-w-0 overflow-y-auto rounded-md border p-3'>
            <p className='text-xs leading-relaxed break-words whitespace-pre-wrap'>
              {props.completion.normalized_output}
            </p>
          </div>
        </div>
      )}

      {props.completion?.reasoning_output && (
        <div className='flex min-w-0 flex-col gap-1.5'>
          <Label>{t('Reasoning output')}</Label>
          <div className='bg-muted/30 max-h-56 min-w-0 overflow-y-auto rounded-md border p-3'>
            <p className='text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-wrap'>
              {props.completion.reasoning_output}
            </p>
          </div>
        </div>
      )}

      {props.rawResponse && (
        <JsonViewer
          label={t('Raw response')}
          value={props.rawResponse.value}
          rawMeta={props.rawResponse}
          maxHeightClassName='h-[min(55dvh,560px)]'
        />
      )}
    </div>
  )
}
