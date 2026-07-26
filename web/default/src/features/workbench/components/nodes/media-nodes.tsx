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
import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import {
  IMAGE_COUNTS,
  IMAGE_SIZES,
  VIDEO_DURATIONS,
  VIDEO_SIZES,
  videoSizeLabel,
} from '@/features/playground/lib/studio/generation-options'

import { useCanvasTheme } from '../../engine/canvas-theme'
import { useWorkbenchModels } from '../../hooks/use-workbench-models'
import { useCanvasStore } from '../../store/canvas-store'
import {
  NodeEmptyMedia,
  NodeModelSelect,
  NodePromptBar,
  NodeStatusOverlay,
  type CanvasNodeBodyProps,
} from './node-shared'

export function ImageNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}
  const batchChildIds = metadata.batchChildIds ?? []
  const updateNodeMetadata = useCanvasStore((state) => state.updateNodeMetadata)

  return (
    <div className='flex h-full flex-col gap-2'>
      <div className='relative min-h-0 flex-1'>
        {metadata.content ? (
          <img
            src={metadata.content}
            alt={props.node.title}
            draggable={false}
            className='h-full w-full rounded-md object-contain'
          />
        ) : (
          <NodeEmptyMedia label={t('Describe the image to generate')} />
        )}
        <NodeStatusOverlay
          status={metadata.status}
          errorDetails={metadata.errorDetails}
        />
        {batchChildIds.length ? (
          <Button
            size='sm'
            variant='secondary'
            className='absolute right-2 bottom-2 h-6 gap-1 px-2 text-[11px]'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              updateNodeMetadata(props.node.id, {
                imageBatchExpanded: !metadata.imageBatchExpanded,
              })
            }
          >
            <Layers className='size-3' />
            {metadata.imageBatchExpanded
              ? t('Collapse batch')
              : `${batchChildIds.length + 1}`}
          </Button>
        ) : null}
      </div>

      <NodePromptBar
        value={metadata.prompt ?? ''}
        placeholder={t('Describe the image to generate')}
        isGenerating={props.isGenerating}
        disabled={!metadata.model}
        onChange={(prompt) => props.onMetadataChange({ prompt })}
        onGenerate={props.onGenerate}
        onCancel={props.onCancel}
      >
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality('image')}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </NodePromptBar>

      <div className='flex items-center gap-2' data-canvas-no-zoom>
        <NativeSelect
          size='sm'
          className='min-w-0 flex-1'
          value={metadata.size ?? 'auto'}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            props.onMetadataChange({ size: event.target.value })
          }
        >
          {IMAGE_SIZES.map((option) => (
            <option key={option} value={option}>
              {option === 'auto' ? t('Auto') : option}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          className='w-24'
          value={String(metadata.count ?? 1)}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            props.onMetadataChange({ count: Number(event.target.value) })
          }
        >
          {IMAGE_COUNTS.map((option) => (
            <option key={option} value={option}>
              {t('{{count}} images', { count: option })}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}

export function VideoNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}

  return (
    <div className='flex h-full flex-col gap-2'>
      <div className='relative min-h-0 flex-1'>
        {metadata.content ? (
          <video
            src={metadata.content}
            controls
            className='h-full w-full rounded-md object-contain'
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <NodeEmptyMedia label={t('Describe the video to generate')} />
        )}
        <NodeStatusOverlay
          status={metadata.status}
          progress={metadata.taskProgress}
          errorDetails={metadata.errorDetails}
        />
      </div>

      <NodePromptBar
        value={metadata.prompt ?? ''}
        placeholder={t('Describe the video to generate')}
        isGenerating={props.isGenerating}
        disabled={!metadata.model}
        onChange={(prompt) => props.onMetadataChange({ prompt })}
        onGenerate={props.onGenerate}
        onCancel={props.onCancel}
      >
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality('video')}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </NodePromptBar>

      <div className='flex items-center gap-2' data-canvas-no-zoom>
        <NativeSelect
          size='sm'
          className='min-w-0 flex-1'
          value={metadata.size ?? VIDEO_SIZES[0]}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            props.onMetadataChange({ size: event.target.value })
          }
        >
          {VIDEO_SIZES.map((option) => (
            <option key={option} value={option}>
              {videoSizeLabel(option)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          className='w-24'
          value={metadata.seconds ?? String(VIDEO_DURATIONS[0])}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            props.onMetadataChange({ seconds: event.target.value })
          }
        >
          {VIDEO_DURATIONS.map((option) => (
            <option key={option} value={option}>
              {t('{{count}}s', { count: option })}
            </option>
          ))}
        </NativeSelect>
      </div>

      <label
        className='flex items-center gap-2 text-[11px]'
        data-canvas-no-zoom
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Checkbox
          checked={!metadata.disableLastFrame}
          onCheckedChange={(checked) =>
            props.onMetadataChange({ disableLastFrame: !checked })
          }
        />
        <span style={{ color: theme.node.muted }}>
          {t('Use the second connected image as the tail frame')}
        </span>
      </label>
    </div>
  )
}

export function AudioNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}

  return (
    <div className='flex h-full flex-col gap-2'>
      <div className='relative'>
        {metadata.content ? (
          <audio
            src={metadata.content}
            controls
            className='w-full'
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <div
            className='rounded-md border border-dashed px-2 py-3 text-center text-xs'
            style={{
              borderColor: theme.node.stroke,
              color: theme.node.placeholder,
            }}
          >
            {t('Enter the text to speak')}
          </div>
        )}
        <NodeStatusOverlay
          status={metadata.status}
          errorDetails={metadata.errorDetails}
        />
      </div>

      <NodePromptBar
        value={metadata.prompt ?? ''}
        placeholder={t('Enter the text to speak')}
        isGenerating={props.isGenerating}
        disabled={!metadata.model}
        onChange={(prompt) => props.onMetadataChange({ prompt })}
        onGenerate={props.onGenerate}
        onCancel={props.onCancel}
      >
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality('audio')}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </NodePromptBar>
    </div>
  )
}
