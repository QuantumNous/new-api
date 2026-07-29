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
import { Image as ImageIcon, Layers, Music, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  IMAGE_COUNTS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  VIDEO_DURATIONS,
  VIDEO_SIZES,
  AUDIO_FORMATS,
  SPEEDS,
  VOICES,
  videoSizeLabel,
} from '@/features/playground/lib/studio/generation-options'

import { useCanvasTheme } from '../../engine/canvas-theme'
import { useWorkbenchModels } from '../../hooks/use-workbench-models'
import { useCanvasStore } from '../../store/canvas-store'
import {
  NodeEmptyMedia,
  NodeModelSelect,
  NodePromptBar,
  NodeSettingsChips,
  NodeStatusOverlay,
  type CanvasNodeBodyProps,
} from './node-shared'

export function ImageNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}
  const batchChildIds = metadata.batchChildIds ?? []
  const updateNodeMetadata = useCanvasStore((state) => state.updateNodeMetadata)
  const experienceMode = useCanvasStore((state) => state.experienceMode)
  const hasNatural = Boolean(metadata.naturalWidth && metadata.naturalHeight)
  const naturalAspect =
    hasNatural && metadata.naturalHeight
      ? `${metadata.naturalWidth} / ${metadata.naturalHeight}`
      : undefined

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div
        className='bg-muted/30 ring-border/50 relative flex min-h-24 flex-1 items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset'
        style={naturalAspect ? { aspectRatio: naturalAspect } : undefined}
      >
        {metadata.content ? (
          <img
            src={metadata.content}
            alt={props.node.title}
            draggable={false}
            className='max-h-full max-w-full rounded-xl object-contain'
          />
        ) : (
          <NodeEmptyMedia
            icon={<ImageIcon className='size-4' />}
            label={t('Describe the image to generate')}
          />
        )}
        <NodeStatusOverlay
          status={metadata.status}
          errorDetails={metadata.errorDetails}
        />
        {metadata.content && hasNatural ? (
          <span className='bg-background/85 text-foreground/90 pointer-events-none absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[10px] shadow-sm backdrop-blur-sm'>
            {metadata.naturalWidth}×{metadata.naturalHeight}
          </span>
        ) : null}
        {metadata.content ? (
          <div className='absolute bottom-2 left-2'>
            <NodeSettingsChips
              items={[
                metadata.size ?? 'auto',
                metadata.quality ?? 'auto',
                `×${metadata.count ?? 1}`,
              ]}
            />
          </div>
        ) : null}
        {batchChildIds.length ? (
          <Button
            size='sm'
            variant='secondary'
            className='absolute right-2 bottom-2 h-6 gap-1 rounded-full px-2 text-[11px]'
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
        modality='image'
        nodeId={props.node.id}
      >
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality('image')}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </NodePromptBar>

      <div
        className={
          experienceMode === 'professional'
            ? 'flex shrink-0 flex-wrap items-center gap-2'
            : 'hidden'
        }
        data-canvas-no-zoom
      >
        <label className='flex items-center gap-1 text-[11px]'>
          <Checkbox
            checked={Boolean(metadata.freeResize)}
            onCheckedChange={(checked) =>
              props.onMetadataChange({ freeResize: checked === true })
            }
          />
          {t('Free resize')}
        </label>
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
          value={metadata.quality ?? 'auto'}
          onChange={(event) =>
            props.onMetadataChange({ quality: event.target.value })
          }
        >
          {IMAGE_QUALITIES.map((quality) => (
            <option key={quality} value={quality}>
              {t(
                { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High' }[
                  quality
                ]
              )}
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
      <label
        className={
          experienceMode === 'professional'
            ? 'flex shrink-0 items-center gap-2 text-[11px]'
            : 'hidden'
        }
        title={t(
          'Transparent background is not supported by this generation API.'
        )}
      >
        <Checkbox disabled checked={false} /> {t('Transparent background')}
      </label>
    </div>
  )
}

export function VideoNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}
  const experienceMode = useCanvasStore((state) => state.experienceMode)
  const hasNatural = Boolean(metadata.naturalWidth && metadata.naturalHeight)
  const naturalAspect =
    hasNatural && metadata.naturalHeight
      ? `${metadata.naturalWidth} / ${metadata.naturalHeight}`
      : undefined

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div
        className='bg-muted/30 ring-border/50 relative flex min-h-24 flex-1 items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset'
        style={naturalAspect ? { aspectRatio: naturalAspect } : undefined}
      >
        {metadata.content ? (
          <video
            src={metadata.content}
            controls
            className='max-h-full max-w-full rounded-xl object-contain'
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <NodeEmptyMedia
            icon={<Video className='size-4' />}
            label={t('Describe the video to generate')}
          />
        )}
        <NodeStatusOverlay
          status={metadata.status}
          taskStatus={metadata.taskStatus}
          progress={metadata.taskProgress}
          errorDetails={metadata.errorDetails}
        />
        {metadata.content && hasNatural ? (
          <span className='bg-background/85 text-foreground/90 pointer-events-none absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[10px] shadow-sm backdrop-blur-sm'>
            {metadata.naturalWidth}×{metadata.naturalHeight}
          </span>
        ) : null}
      </div>

      <NodePromptBar
        value={metadata.prompt ?? ''}
        placeholder={t('Describe the video to generate')}
        isGenerating={props.isGenerating}
        disabled={!metadata.model}
        onChange={(prompt) => props.onMetadataChange({ prompt })}
        onGenerate={props.onGenerate}
        onCancel={props.onCancel}
        modality='video'
        nodeId={props.node.id}
      >
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality('video')}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </NodePromptBar>

      <NodeSettingsChips
        items={[
          videoSizeLabel(metadata.size ?? VIDEO_SIZES[0]),
          `${metadata.seconds ?? VIDEO_DURATIONS[0]}s`,
        ]}
      />
      <div
        className={
          experienceMode === 'professional'
            ? 'flex shrink-0 flex-wrap items-center gap-2'
            : 'hidden'
        }
        data-canvas-no-zoom
      >
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
        className={
          experienceMode === 'professional'
            ? 'flex shrink-0 items-start gap-2 text-[11px]'
            : 'hidden'
        }
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
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}
  const experienceMode = useCanvasStore((state) => state.experienceMode)

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div className='bg-muted/30 ring-border/50 relative flex min-h-14 flex-1 items-center overflow-hidden rounded-xl px-2 ring-1 ring-inset'>
        {metadata.content ? (
          <audio
            src={metadata.content}
            controls
            className='w-full'
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <NodeEmptyMedia
            icon={<Music className='size-4' />}
            label={t('Enter the text to speak')}
          />
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
        modality='audio'
        nodeId={props.node.id}
      >
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality('audio')}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </NodePromptBar>
      <NodeSettingsChips
        items={[
          metadata.audioVoice ?? 'alloy',
          metadata.audioFormat ?? 'mp3',
          `${metadata.audioSpeed ?? '1'}×`,
        ]}
      />
      <div
        className={
          experienceMode === 'professional'
            ? 'grid shrink-0 grid-cols-3 gap-2'
            : 'hidden'
        }
        data-canvas-no-zoom
      >
        <NativeSelect
          size='sm'
          value={metadata.audioVoice ?? 'alloy'}
          onChange={(event) =>
            props.onMetadataChange({ audioVoice: event.target.value })
          }
        >
          {VOICES.map((voice) => (
            <option key={voice}>{voice}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          value={metadata.audioFormat ?? 'mp3'}
          onChange={(event) =>
            props.onMetadataChange({ audioFormat: event.target.value })
          }
        >
          {AUDIO_FORMATS.map((format) => (
            <option key={format}>{format}</option>
          ))}
        </NativeSelect>
        <NativeSelect
          size='sm'
          value={metadata.audioSpeed ?? '1'}
          onChange={(event) =>
            props.onMetadataChange({ audioSpeed: event.target.value })
          }
        >
          {SPEEDS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}×
            </option>
          ))}
        </NativeSelect>
      </div>
      {experienceMode === 'professional' ? (
        <Textarea
          value={metadata.audioInstructions ?? ''}
          placeholder={t('Voice instructions')}
          rows={2}
          className='min-h-10 shrink-0 resize-none text-xs'
          onChange={(event) =>
            props.onMetadataChange({ audioInstructions: event.target.value })
          }
        />
      ) : null}
    </div>
  )
}
