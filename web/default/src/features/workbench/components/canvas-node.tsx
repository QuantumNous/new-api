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
import { Download, Lock, Trash2, Unlock } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { isFrameNode } from '../engine/canvas-frame'
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
      className='absolute flex flex-col rounded-lg border text-xs shadow-sm'
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
      onPointerDown={(event) =>
        props.interactions.startNodeDrag(event, node.id)
      }
    >
      <div
        className='flex shrink-0 items-center gap-1 px-2 py-1.5'
        style={{ color: theme.node.label }}
      >
        <span className='truncate'>{node.title}</span>
        <div className='ml-auto flex items-center gap-1' data-canvas-no-zoom>
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

      <div className='min-h-0 flex-1 px-2 pb-2'>
        <NodeBody
          type={node.type}
          node={node}
          selected={props.selected}
          isGenerating={props.isGenerating}
          onMetadataChange={(patch) => updateNodeMetadata(node.id, patch)}
          onGenerate={() => props.onGenerate(node.id)}
          onCancel={() => props.onCancel(node.id)}
        />
      </div>

      {frame ? null : (
        <>
          <button
            type='button'
            aria-label={t('Connect from this node')}
            data-handle-type='source'
            className='absolute top-1/2 -right-2 size-3 -translate-y-1/2 rounded-full border'
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
            className='absolute top-1/2 -left-2 size-3 -translate-y-1/2 rounded-full border'
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

      {props.selected && !locked
        ? RESIZE_CORNERS.map((corner) => (
            <span
              key={corner}
              className='absolute size-2.5 cursor-nwse-resize rounded-sm border'
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
            />
          ))
        : null}
    </div>
  )
})
