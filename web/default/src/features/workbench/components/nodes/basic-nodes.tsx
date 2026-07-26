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
import { ChevronDown, ChevronRight } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'

import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  AUDIO_FORMATS,
  IMAGE_COUNTS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  SPEEDS,
  VIDEO_DURATIONS,
  VIDEO_SIZES,
  VOICES,
  videoSizeLabel,
} from '@/features/playground/lib/studio/generation-options'

import { useCanvasTheme } from '../../engine/canvas-theme'
import { useWorkbenchModels } from '../../hooks/use-workbench-models'
import { useCanvasStore } from '../../store/canvas-store'
import type { CanvasGenerationMode } from '../../types'
import { NodeModelSelect, type CanvasNodeBodyProps } from './node-shared'

export function TextNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const metadata = props.node.metadata ?? {}

  return (
    <Textarea
      value={metadata.content ?? ''}
      placeholder={t('Write a note or a prompt fragment')}
      className='h-full resize-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0'
      style={{ fontSize: metadata.fontSize ?? 14 }}
      data-canvas-no-zoom
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) =>
        props.onMetadataChange({ content: event.target.value })
      }
    />
  )
}

export function ConfigNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const models = useWorkbenchModels()
  const metadata = props.node.metadata ?? {}
  const mode = metadata.generationMode ?? 'image'

  return (
    <div
      className='flex h-full flex-col gap-2 overflow-auto'
      data-canvas-wheel-scroll
    >
      <Row label={t('Type')}>
        <NativeSelect
          size='sm'
          className='w-full'
          value={mode}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) =>
            props.onMetadataChange({
              generationMode: event.target.value as CanvasGenerationMode,
              model: undefined,
            })
          }
        >
          <option value='image'>{t('Image')}</option>
          <option value='video'>{t('Video')}</option>
          <option value='audio'>{t('Audio')}</option>
        </NativeSelect>
      </Row>

      <Row label={t('Model')}>
        <NodeModelSelect
          value={metadata.model}
          options={models.byModality(mode === 'text' ? 'chat' : mode)}
          onChange={(model) => props.onMetadataChange({ model })}
        />
      </Row>

      {mode === 'image' ? (
        <>
          <Row label={t('Size')}>
            <SelectOptions
              value={metadata.size ?? IMAGE_SIZES[0]}
              options={IMAGE_SIZES.map((size) => ({
                value: size,
                label: size === 'auto' ? t('Auto') : size,
              }))}
              onChange={(size) => props.onMetadataChange({ size })}
            />
          </Row>
          <Row label={t('Quality')}>
            <SelectOptions
              value={metadata.quality ?? IMAGE_QUALITIES[0]}
              options={IMAGE_QUALITIES.map((quality) => ({
                value: quality,
                label: quality,
              }))}
              onChange={(quality) => props.onMetadataChange({ quality })}
            />
          </Row>
          <Row label={t('Count')}>
            <SelectOptions
              value={String(metadata.count ?? 1)}
              options={IMAGE_COUNTS.map((count) => ({
                value: String(count),
                label: String(count),
              }))}
              onChange={(count) =>
                props.onMetadataChange({ count: Number(count) })
              }
            />
          </Row>
        </>
      ) : null}

      {mode === 'video' ? (
        <>
          <Row label={t('Size')}>
            <SelectOptions
              value={metadata.size ?? VIDEO_SIZES[0]}
              options={VIDEO_SIZES.map((size) => ({
                value: size,
                label: videoSizeLabel(size),
              }))}
              onChange={(size) => props.onMetadataChange({ size })}
            />
          </Row>
          <Row label={t('Duration (seconds)')}>
            <SelectOptions
              value={metadata.seconds ?? String(VIDEO_DURATIONS[0])}
              options={VIDEO_DURATIONS.map((duration) => ({
                value: String(duration),
                label: String(duration),
              }))}
              onChange={(seconds) => props.onMetadataChange({ seconds })}
            />
          </Row>
        </>
      ) : null}

      {mode === 'audio' ? (
        <>
          <Row label={t('Voice')}>
            <SelectOptions
              value={metadata.audioVoice ?? VOICES[0]}
              options={VOICES.map((voice) => ({ value: voice, label: voice }))}
              onChange={(audioVoice) => props.onMetadataChange({ audioVoice })}
            />
          </Row>
          <Row label={t('Format')}>
            <SelectOptions
              value={metadata.audioFormat ?? AUDIO_FORMATS[0]}
              options={AUDIO_FORMATS.map((format) => ({
                value: format,
                label: format,
              }))}
              onChange={(audioFormat) =>
                props.onMetadataChange({ audioFormat })
              }
            />
          </Row>
          <Row label={t('Speed')}>
            <SelectOptions
              value={metadata.audioSpeed ?? String(SPEEDS[1])}
              options={SPEEDS.map((speed) => ({
                value: String(speed),
                label: `${speed}x`,
              }))}
              onChange={(audioSpeed) => props.onMetadataChange({ audioSpeed })}
            />
          </Row>
        </>
      ) : null}
    </div>
  )
}

export function FrameNodeBody(props: CanvasNodeBodyProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const updateNode = useCanvasStore((state) => state.updateNode)
  const frame = props.node.metadata?.frame
  const collapsed = Boolean(frame?.collapsed)

  return (
    <button
      type='button'
      className='flex items-center gap-1 rounded px-1 text-xs'
      style={{ color: theme.node.muted }}
      data-canvas-no-zoom
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() =>
        updateNode(props.node.id, {
          width: collapsed ? (frame?.expandedWidth ?? props.node.width) : 260,
          height: collapsed ? (frame?.expandedHeight ?? props.node.height) : 44,
          metadata: {
            ...props.node.metadata,
            frame: {
              collapsed: !collapsed,
              expandedWidth: collapsed
                ? (frame?.expandedWidth ?? props.node.width)
                : props.node.width,
              expandedHeight: collapsed
                ? (frame?.expandedHeight ?? props.node.height)
                : props.node.height,
            },
          },
        })
      }
    >
      {collapsed ? (
        <ChevronRight className='size-3.5' />
      ) : (
        <ChevronDown className='size-3.5' />
      )}
      {collapsed ? t('Expand frame') : t('Collapse frame')}
    </button>
  )
}

function Row(props: { label: string; children: React.ReactNode }) {
  const theme = useCanvasTheme()
  return (
    <label className='flex items-center gap-2 text-xs'>
      <span className='w-20 shrink-0' style={{ color: theme.node.muted }}>
        {props.label}
      </span>
      {props.children}
    </label>
  )
}

function SelectOptions(props: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <NativeSelect
      size='sm'
      className='min-w-0 flex-1'
      value={props.value}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  )
}
