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
import {
  CopyPlus,
  Download,
  Lock,
  RefreshCw,
  Trash2,
  Unlock,
  Columns3,
  Expand,
  MoreHorizontal,
  ClipboardCopy,
  RotateCw,
  Crop,
  ImagePlus,
  ListPlus,
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { isFrameNode } from '../engine/canvas-frame'
import { arrowDelta, keyboardStep } from '../engine/canvas-media-transform'
import { useCanvasTheme } from '../engine/canvas-theme'
import type { CanvasInteractions } from '../hooks/use-canvas-interactions'
import { useCanvasStore } from '../store/canvas-store'
import { CanvasNodeType, type CanvasNodeData } from '../types'
import {
  ConfigNodeBody,
  FrameNodeBody,
  TextNodeBody,
} from './nodes/basic-nodes'
import {
  AudioNodeBody,
  ImageNodeBody,
  VideoNodeBody,
} from './nodes/media-nodes'
import type { CanvasNodeBodyProps } from './nodes/node-shared'
import { StoryboardNodeBody } from './nodes/storyboard-node'

type CanvasNodeProps = {
  node: CanvasNodeData
  selected: boolean
  dragging: boolean
  isGenerating: boolean
  interactions: CanvasInteractions
  onGenerate: (nodeId: string) => void
  onCancel: (nodeId: string) => void
  onDownload?: (nodeId: string) => void
  onReplaceMedia?: (nodeId: string) => void
  onMediaAction?: (
    nodeId: string,
    action:
      | 'preview'
      | 'copy-prompt'
      | 'rotate'
      | 'crop'
      | 'current-frame'
      | 'tail-frame'
  ) => void
  readOnly?: boolean
}

const RESIZE_CORNERS = ['nw', 'ne', 'sw', 'se'] as const

function NodeBody(props: CanvasNodeBodyProps & { type: CanvasNodeType }) {
  const { type, ...body } = props
  if (type === CanvasNodeType.Image) return <ImageNodeBody {...body} />
  if (type === CanvasNodeType.Video) return <VideoNodeBody {...body} />
  if (type === CanvasNodeType.Audio) return <AudioNodeBody {...body} />
  if (type === CanvasNodeType.Text) return <TextNodeBody {...body} />
  if (type === CanvasNodeType.Config) return <ConfigNodeBody {...body} />
  if (type === CanvasNodeType.Script) return <StoryboardNodeBody {...body} />
  return <FrameNodeBody {...body} />
}

export const CanvasNode = memo(function CanvasNode(props: CanvasNodeProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const node = props.node
  const frame = isFrameNode(node)
  const locked = Boolean(node.metadata?.locked)
  const updateNodeMetadata = useCanvasStore((state) => state.updateNodeMetadata)
  const removeNodes = useCanvasStore((state) => state.removeNodes)
  const idleBorderColor = frame ? theme.frame.stroke : theme.node.stroke

  return (
    <div
      data-node-id={node.id}
      tabIndex={props.readOnly ? -1 : 0}
      role='group'
      aria-label={t('{{title}} canvas node', { title: node.title })}
      aria-selected={props.selected}
      className='group absolute flex flex-col rounded-lg border text-xs shadow-sm outline-none focus-visible:ring-2'
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        background: frame ? theme.frame.fill : theme.node.panel,
        borderColor: props.selected ? theme.accent.primary : idleBorderColor,
        borderStyle: frame ? 'dashed' : 'solid',
        color: theme.node.text,
        opacity: props.dragging ? 0.85 : 1,
        boxShadow: props.selected
          ? `0 0 0 2px ${theme.accent.primarySoft}`
          : undefined,
      }}
      onPointerDown={(event) => {
        if (!props.readOnly) props.interactions.startNodeDrag(event, node.id)
      }}
      onKeyDown={(event) => {
        if (props.readOnly) return
        if (
          (event.key === 'Enter' || event.key === ' ') &&
          event.target === event.currentTarget
        ) {
          event.preventDefault()
          useCanvasStore.getState().setSelectedNodes([node.id])
          return
        }
        if (
          !event.key.startsWith('Arrow') ||
          locked ||
          event.target !== event.currentTarget
        ) {
          return
        }
        event.preventDefault()
        const delta = arrowDelta(event.key, keyboardStep(event.shiftKey))
        useCanvasStore.getState().moveNodes([
          {
            id: node.id,
            x: node.position.x + delta.x,
            y: node.position.y + delta.y,
          },
        ])
        useCanvasStore.getState().commitNodeDrag([node.id])
      }}
    >
      <div
        className='flex shrink-0 items-center gap-1 px-2 py-1.5'
        style={{ color: theme.node.label }}
      >
        <span className='truncate'>{node.title}</span>
        {node.metadata?.versionLabel ? (
          <span className='bg-muted rounded px-1 font-semibold'>
            {node.metadata.versionLabel}
            {node.metadata.versionPrimary ? ' ★' : ''}
          </span>
        ) : null}
        <div
          className={`ml-auto items-center gap-1 group-focus-within:flex group-hover:flex [@media(pointer:coarse)]:flex ${props.selected ? 'flex' : 'hidden'}`}
          data-canvas-no-zoom
          hidden={props.readOnly}
        >
          {mediaKindForType(node.type) ? (
            <button
              type='button'
              title={t('More actions')}
              aria-label={t('More actions')}
              className='hidden min-h-10 min-w-10 items-center justify-center rounded [@media(pointer:coarse)]:flex'
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() =>
                useCanvasStore.getState().setSelectedNodes([node.id])
              }
            >
              <MoreHorizontal className='size-4' />
            </button>
          ) : null}
          <button
            type='button'
            title={t('Toggle multi-select')}
            className='hidden min-h-10 min-w-10 items-center justify-center rounded [@media(pointer:coarse)]:flex'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              const store = useCanvasStore.getState()
              const selected = new Set(store.selectedNodeIds)
              if (selected.has(node.id)) selected.delete(node.id)
              else selected.add(node.id)
              store.setSelectedNodes([...selected])
            }}
          >
            <ListPlus className='size-4' />
          </button>
          {mediaKindForType(node.type) ? (
            <>
              <button
                type='button'
                title={t('Create parameter variant')}
                className='rounded p-1 opacity-60 hover:opacity-100'
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() =>
                  useCanvasStore.getState().createNodeVariant(node.id)
                }
              >
                <CopyPlus className='size-3' />
              </button>
              {node.metadata?.versionRootId ? (
                <button
                  type='button'
                  title={t('Compare versions')}
                  className='rounded p-1 opacity-60 hover:opacity-100'
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('canvas:compare-versions', {
                        detail: node.id,
                      })
                    )
                  }
                >
                  <Columns3 className='size-3' />
                </button>
              ) : null}
            </>
          ) : null}
          {mediaKindForType(node.type) && props.onReplaceMedia ? (
            <button
              type='button'
              title={t('Replace media')}
              className='rounded p-1 opacity-60 hover:opacity-100'
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => props.onReplaceMedia?.(node.id)}
            >
              <RefreshCw className='size-3' />
            </button>
          ) : null}
          {node.metadata?.content && props.onDownload ? (
            <button
              type='button'
              title={t('Download')}
              className='rounded p-1 opacity-60 hover:opacity-100'
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => props.onDownload?.(node.id)}
            >
              <Download className='size-3' />
            </button>
          ) : null}
          {node.metadata?.content && props.onMediaAction ? (
            <>
              <button
                type='button'
                title={t('Fullscreen preview')}
                className='rounded p-1 opacity-60 hover:opacity-100'
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => props.onMediaAction?.(node.id, 'preview')}
              >
                <Expand className='size-3' />
              </button>
              {node.type === CanvasNodeType.Image ? (
                <>
                  <button
                    type='button'
                    title={t('Copy prompt')}
                    className='rounded p-1 opacity-60 hover:opacity-100'
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      props.onMediaAction?.(node.id, 'copy-prompt')
                    }
                  >
                    <ClipboardCopy className='size-3' />
                  </button>
                  <button
                    type='button'
                    title={t('Rotate image')}
                    className='rounded p-1 opacity-60 hover:opacity-100'
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => props.onMediaAction?.(node.id, 'rotate')}
                  >
                    <RotateCw className='size-3' />
                  </button>
                  <button
                    type='button'
                    title={t('Crop image')}
                    className='rounded p-1 opacity-60 hover:opacity-100'
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => props.onMediaAction?.(node.id, 'crop')}
                  >
                    <Crop className='size-3' />
                  </button>
                </>
              ) : null}
              {node.type === CanvasNodeType.Video ? (
                <>
                  <button
                    type='button'
                    title={t('Capture current frame')}
                    className='rounded p-1 opacity-60 hover:opacity-100'
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      props.onMediaAction?.(node.id, 'current-frame')
                    }
                  >
                    <ImagePlus className='size-3' />
                  </button>
                  <button
                    type='button'
                    title={t('Capture tail frame')}
                    className='rounded p-1 opacity-60 hover:opacity-100'
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => props.onMediaAction?.(node.id, 'tail-frame')}
                  >
                    <ImagePlus className='size-3 rotate-180' />
                  </button>
                </>
              ) : null}
            </>
          ) : null}
          <button
            type='button'
            title={locked ? t('Unlock') : t('Lock')}
            className='rounded p-1 opacity-60 hover:opacity-100'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => updateNodeMetadata(node.id, { locked: !locked })}
          >
            {locked ? (
              <Lock className='size-3' />
            ) : (
              <Unlock className='size-3' />
            )}
          </button>
          <button
            type='button'
            title={t('Delete')}
            className='rounded p-1 opacity-60 hover:opacity-100'
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => removeNodes([node.id])}
          >
            <Trash2 className='size-3' />
          </button>
        </div>
      </div>

      <fieldset disabled={props.readOnly} className='min-h-0 flex-1 px-2 pb-2'>
        <NodeBody
          type={node.type}
          node={node}
          selected={props.selected}
          isGenerating={props.isGenerating}
          readOnly={props.readOnly}
          onMetadataChange={(patch) => {
            if (!props.readOnly) updateNodeMetadata(node.id, patch)
          }}
          onGenerate={() => props.onGenerate(node.id)}
          onCancel={() => props.onCancel(node.id)}
        />
      </fieldset>

      {frame || props.readOnly ? null : (
        <>
          <button
            type='button'
            aria-label={t('Connect from this node')}
            data-handle-type='source'
            className='absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full border sm:-right-2 sm:size-3'
            style={{
              background: theme.node.panel,
              borderColor: theme.accent.primary,
            }}
            onPointerDown={(event) =>
              props.interactions.startConnection(event, {
                nodeId: node.id,
                handleType: 'source',
              })
            }
          />
          <button
            type='button'
            aria-label={t('Connect into this node')}
            data-handle-type='target'
            className='absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full border sm:-left-2 sm:size-3'
            style={{
              background: theme.node.panel,
              borderColor: theme.accent.primary,
            }}
            onPointerDown={(event) =>
              props.interactions.startConnection(event, {
                nodeId: node.id,
                handleType: 'target',
              })
            }
          />
        </>
      )}

      {props.selected && !locked && !props.readOnly
        ? RESIZE_CORNERS.map((corner) => (
            <button
              type='button'
              key={corner}
              aria-label={t('Resize {{corner}} handle', { corner })}
              className='absolute size-5 cursor-nwse-resize rounded-sm border sm:size-3'
              style={{
                background: theme.node.panel,
                borderColor: theme.accent.primary,
                left: corner.endsWith('w') ? -5 : undefined,
                right: corner.endsWith('e') ? -5 : undefined,
                top: corner.startsWith('n') ? -5 : undefined,
                bottom: corner.startsWith('s') ? -5 : undefined,
              }}
              onPointerDown={(event) =>
                props.interactions.startNodeResize(event, node.id, corner)
              }
              onKeyDown={(event) => {
                if (!event.key.startsWith('Arrow')) return
                event.preventDefault()
                const delta = arrowDelta(
                  event.key,
                  keyboardStep(event.shiftKey)
                )
                useCanvasStore.getState().updateNode(node.id, {
                  width: Math.max(160, node.width + delta.x),
                  height: Math.max(96, node.height + delta.y),
                })
              }}
            />
          ))
        : null}
    </div>
  )
})

function mediaKindForType(type: CanvasNodeType): boolean {
  return [
    CanvasNodeType.Image,
    CanvasNodeType.Video,
    CanvasNodeType.Audio,
  ].includes(type)
}
