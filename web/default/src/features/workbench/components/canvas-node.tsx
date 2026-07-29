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
  ClipboardCopy,
  Columns3,
  CopyPlus,
  Crop,
  Download,
  Expand,
  ImagePlus,
  ListPlus,
  Lock,
  MoreHorizontal,
  RefreshCw,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { nodeMinSize } from '../constants'
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
import { nodeAccent } from './nodes/node-accent'
import type { CanvasNodeBodyProps } from './nodes/node-shared'
import { StoryboardNodeBody } from './nodes/storyboard-node'

type MediaAction =
  | 'preview'
  | 'copy-prompt'
  | 'rotate'
  | 'crop'
  | 'current-frame'
  | 'tail-frame'

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
  onMediaAction?: (nodeId: string, action: MediaAction) => void
  readOnly?: boolean
}

const RESIZE_CORNERS = ['nw', 'ne', 'sw', 'se'] as const

const MEDIA_NODE_TYPES = new Set<CanvasNodeType>([
  CanvasNodeType.Image,
  CanvasNodeType.Video,
  CanvasNodeType.Audio,
])

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

function HeaderIconButton(props: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type='button'
      title={props.label}
      aria-label={props.label}
      className='hover:bg-foreground/10 text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md transition-colors'
      onPointerDown={(event) => event.stopPropagation()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/**
 * Secondary node actions live in a menu so the header never squeezes the
 * node title on small nodes.
 */
function NodeActionMenu(props: {
  node: CanvasNodeData
  isMedia: boolean
  onReplaceMedia?: (nodeId: string) => void
  onMediaAction?: (nodeId: string, action: MediaAction) => void
}) {
  const { t } = useTranslation()
  const node = props.node
  const hasContent = Boolean(node.metadata?.content)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type='button'
            title={t('More actions')}
            aria-label={t('More actions')}
            className='hover:bg-foreground/10 text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md transition-colors'
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className='size-3.5' />
          </button>
        }
      />
      <DropdownMenuContent align='end' className='w-52'>
        <DropdownMenuItem
          onClick={() => {
            const store = useCanvasStore.getState()
            const selected = new Set(store.selectedNodeIds)
            if (selected.has(node.id)) selected.delete(node.id)
            else selected.add(node.id)
            store.setSelectedNodes([...selected])
          }}
        >
          <ListPlus />
          {t('Toggle multi-select')}
        </DropdownMenuItem>

        {props.isMedia ? (
          <DropdownMenuItem
            onClick={() => useCanvasStore.getState().createNodeVariant(node.id)}
          >
            <CopyPlus />
            {t('Create parameter variant')}
          </DropdownMenuItem>
        ) : null}

        {props.isMedia && node.metadata?.versionRootId ? (
          <DropdownMenuItem
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('canvas:compare-versions', { detail: node.id })
              )
            }
          >
            <Columns3 />
            {t('Compare versions')}
          </DropdownMenuItem>
        ) : null}

        {props.isMedia && props.onReplaceMedia ? (
          <DropdownMenuItem onClick={() => props.onReplaceMedia?.(node.id)}>
            <RefreshCw />
            {t('Replace media')}
          </DropdownMenuItem>
        ) : null}

        {hasContent &&
        props.onMediaAction &&
        node.type === CanvasNodeType.Image ? (
          <>
            <DropdownMenuItem
              onClick={() => props.onMediaAction?.(node.id, 'copy-prompt')}
            >
              <ClipboardCopy />
              {t('Copy prompt')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => props.onMediaAction?.(node.id, 'rotate')}
            >
              <RotateCw />
              {t('Rotate image')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => props.onMediaAction?.(node.id, 'crop')}
            >
              <Crop />
              {t('Crop image')}
            </DropdownMenuItem>
          </>
        ) : null}

        {hasContent &&
        props.onMediaAction &&
        node.type === CanvasNodeType.Video ? (
          <>
            <DropdownMenuItem
              onClick={() => props.onMediaAction?.(node.id, 'current-frame')}
            >
              <ImagePlus />
              {t('Capture current frame')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => props.onMediaAction?.(node.id, 'tail-frame')}
            >
              <ImagePlus className='rotate-180' />
              {t('Capture tail frame')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const CanvasNode = memo(function CanvasNode(props: CanvasNodeProps) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const node = props.node
  const frame = isFrameNode(node)
  const locked = Boolean(node.metadata?.locked)
  const isMedia = MEDIA_NODE_TYPES.has(node.type)
  const hasContent = Boolean(node.metadata?.content)
  const minSize = nodeMinSize(node.type)
  const accent = nodeAccent(node.type)
  const viewportScale = useCanvasStore((state) => state.viewport.k)
  const updateNodeMetadata = useCanvasStore((state) => state.updateNodeMetadata)
  const removeNodes = useCanvasStore((state) => state.removeNodes)
  const idleBorderColor = frame ? theme.frame.stroke : theme.node.stroke
  // Keep handles and resize corners usable at far-out zoom levels.
  const handleScale = viewportScale < 0.6 ? 1 / viewportScale : 1
  const generating = props.isGenerating && !frame

  let boxShadow: string | undefined
  if (generating) {
    boxShadow = `0 0 0 2px ${accent.ring}, 0 0 32px ${theme.spatial.glowStrong}`
  } else if (props.selected) {
    boxShadow = `0 0 0 2px ${accent.ring}, 0 18px 40px -18px ${theme.spatial.shadow}`
  } else if (!frame) {
    boxShadow = `0 1px 2px ${theme.spatial.shadow}, 0 8px 28px -20px ${theme.spatial.shadow}`
  }

  let borderColor: string = idleBorderColor
  if (generating) borderColor = accent.ring
  if (props.selected) borderColor = accent.ring

  return (
    <div
      data-node-id={node.id}
      data-guide='node-card'
      tabIndex={props.readOnly ? -1 : 0}
      role='group'
      aria-label={t('{{title}} canvas node', { title: node.title })}
      aria-selected={props.selected}
      className={cn(
        'group absolute flex flex-col overflow-hidden text-xs outline-none transition-[box-shadow,border-color,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        frame ? 'rounded-2xl border' : 'rounded-xl border',
        generating && 'canvas-node-generating',
        props.dragging && 'scale-[1.01]'
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        background: frame ? theme.frame.fill : theme.node.panel,
        borderColor,
        borderStyle: frame ? 'dashed' : 'solid',
        color: theme.node.text,
        opacity: props.dragging ? 0.92 : 1,
        boxShadow,
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
        className={cn(
          'relative flex h-9 shrink-0 items-center gap-2 px-3',
          frame ? null : 'bg-gradient-to-r to-transparent',
          frame ? null : accent.wash
        )}
        style={{ color: theme.node.label }}
      >
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100',
            accent.chip,
            generating && 'animate-pulse'
          )}
          aria-hidden='true'
        >
          <accent.icon className='size-3' />
        </span>
        <span
          className='min-w-0 flex-1 truncate text-[12px] font-semibold tracking-tight'
          style={{ color: theme.node.text }}
        >
          {node.title}
        </span>
        {node.metadata?.versionLabel ? (
          <span className='bg-foreground/8 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold'>
            {node.metadata.versionLabel}
            {node.metadata.versionPrimary ? ' ★' : ''}
          </span>
        ) : null}
        <div
          className={cn(
            'shrink-0 items-center gap-0.5 rounded-lg group-focus-within:flex group-hover:flex [@media(pointer:coarse)]:flex',
            props.selected ? 'flex' : 'hidden'
          )}
          data-canvas-no-zoom
          hidden={props.readOnly}
        >
          {hasContent && props.onDownload ? (
            <HeaderIconButton
              label={t('Download')}
              onClick={() => props.onDownload?.(node.id)}
            >
              <Download className='size-3.5' />
            </HeaderIconButton>
          ) : null}
          {hasContent && props.onMediaAction ? (
            <HeaderIconButton
              label={t('Fullscreen preview')}
              onClick={() => props.onMediaAction?.(node.id, 'preview')}
            >
              <Expand className='size-3.5' />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton
            label={locked ? t('Unlock') : t('Lock')}
            onClick={() => updateNodeMetadata(node.id, { locked: !locked })}
          >
            {locked ? (
              <Lock className='size-3.5' />
            ) : (
              <Unlock className='size-3.5' />
            )}
          </HeaderIconButton>
          <HeaderIconButton
            label={t('Delete')}
            onClick={() => removeNodes([node.id])}
          >
            <Trash2 className='size-3.5' />
          </HeaderIconButton>
          {frame ? null : (
            <NodeActionMenu
              node={node}
              isMedia={isMedia}
              onReplaceMedia={props.onReplaceMedia}
              onMediaAction={props.onMediaAction}
            />
          )}
        </div>
      </div>

      <fieldset
        disabled={props.readOnly}
        className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2.5 pb-2.5'
      >
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
            title={t('Drag to the next step')}
            data-handle-type='source'
            data-guide='node-handle'
            className='absolute top-1/2 -right-2 size-6 -translate-y-1/2 rounded-full border-2 opacity-70 transition-[opacity,transform,box-shadow] duration-150 group-focus-within:opacity-100 group-hover:scale-110 group-hover:opacity-100 hover:opacity-100 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:scale-100 sm:size-3.5'
            style={{
              background: theme.node.panel,
              borderColor: accent.ring,
              transform:
                handleScale > 1
                  ? `translateY(-50%) scale(${handleScale.toFixed(2)})`
                  : undefined,
              transformOrigin: 'right center',
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
            className='absolute top-1/2 -left-2 size-6 -translate-y-1/2 rounded-full border-2 opacity-70 transition-[opacity,transform,box-shadow] duration-150 group-focus-within:opacity-100 group-hover:scale-110 group-hover:opacity-100 hover:opacity-100 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:scale-100 sm:size-3.5'
            style={{
              background: theme.node.panel,
              borderColor: theme.node.faint,
              transform:
                handleScale > 1
                  ? `translateY(-50%) scale(${handleScale.toFixed(2)})`
                  : undefined,
              transformOrigin: 'left center',
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
        ? RESIZE_CORNERS.map((corner) => {
            const cornerOrigin: Record<
              (typeof RESIZE_CORNERS)[number],
              string
            > = {
              nw: 'top left',
              ne: 'top right',
              sw: 'bottom left',
              se: 'bottom right',
            }
            return (
              <button
                type='button'
                key={corner}
                aria-label={t('Resize {{corner}} handle', { corner })}
                className='absolute size-5 cursor-nwse-resize rounded-[4px] border-2 transition-transform duration-150 hover:scale-125 active:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:size-3'
                style={{
                  background: theme.node.panel,
                  borderColor: accent.ring,
                  boxShadow: `0 1px 3px ${theme.spatial.shadow}`,
                  left: corner.endsWith('w') ? -5 : undefined,
                  right: corner.endsWith('e') ? -5 : undefined,
                  top: corner.startsWith('n') ? -5 : undefined,
                  bottom: corner.startsWith('s') ? -5 : undefined,
                  transform:
                    handleScale > 1
                      ? `scale(${handleScale.toFixed(2)})`
                      : undefined,
                  transformOrigin: cornerOrigin[corner],
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
                    width: Math.max(minSize.width, node.width + delta.x),
                    height: Math.max(minSize.height, node.height + delta.y),
                  })
                }}
              />
            )
          })
        : null}
    </div>
  )
})
