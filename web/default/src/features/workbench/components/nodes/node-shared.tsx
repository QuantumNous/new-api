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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { Loader2 } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import { useCanvasTheme } from '../../engine/canvas-theme'
import type { CanvasNodeData, CanvasNodeMetadata } from '../../types'

export const MISSING_MODEL_ERROR = 'Select a model before generating.'

export type CanvasNodeBodyProps = {
  node: CanvasNodeData
  selected: boolean
  isGenerating: boolean
  onMetadataChange: (patch: Partial<CanvasNodeMetadata>) => void
  onGenerate: () => void
  onCancel: () => void
}

export function NodePromptBar(props: {
  value: string
  placeholder: string
  disabled?: boolean
  isGenerating: boolean
  onChange: (value: string) => void
  onGenerate: () => void
  onCancel: () => void
  children?: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-2' data-canvas-no-zoom>
      <Textarea
        value={props.value}
        placeholder={props.placeholder}
        rows={2}
        className='min-h-[52px] resize-none text-xs'
        onChange={(event) => props.onChange(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <div className='flex items-center gap-2'>
        {props.children}
        {props.isGenerating ? (
          <Button
            size='sm'
            variant='outline'
            className='ml-auto h-7 px-2 text-xs'
            onClick={props.onCancel}
          >
            {t('Cancel')}
          </Button>
        ) : (
          <Button
            size='sm'
            className='ml-auto h-7 px-3 text-xs'
            disabled={props.disabled}
            onClick={props.onGenerate}
          >
            {t('Generate')}
          </Button>
        )}
      </div>
    </div>
  )
}

export function NodeModelSelect(props: {
  value?: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <NativeSelect
      size='sm'
      className='min-w-0 flex-1'
      value={props.value ?? ''}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => props.onChange(event.target.value)}
    >
      <option value=''>{t('Select a model')}</option>
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  )
}

export function NodeStatusOverlay(props: {
  status?: string
  progress?: number
  errorDetails?: string
}) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()

  if (props.status === 'loading') {
    return (
      <div
        className='absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md text-xs'
        style={{ background: theme.spatial.dropzone, color: theme.node.muted }}
      >
        <Loader2 className='size-4 animate-spin' />
        {typeof props.progress === 'number'
          ? `${props.progress}%`
          : t('Generating')}
      </div>
    )
  }
  if (props.status === 'error') {
    return (
      <div
        className='absolute inset-0 flex items-center justify-center rounded-md p-3 text-center text-xs'
        style={{
          background: theme.spatial.dropzone,
          color: theme.accent.danger,
        }}
      >
        {props.errorDetails === MISSING_MODEL_ERROR
          ? t('Select a model before generating.')
          : props.errorDetails || t('Generation failed')}
      </div>
    )
  }
  return null
}

export function NodeEmptyMedia(props: { label: string }) {
  const theme = useCanvasTheme()
  return (
    <div
      className='flex h-full w-full items-center justify-center rounded-md border border-dashed text-xs'
      style={{ borderColor: theme.node.stroke, color: theme.node.placeholder }}
    >
      {props.label}
    </div>
  )
}
