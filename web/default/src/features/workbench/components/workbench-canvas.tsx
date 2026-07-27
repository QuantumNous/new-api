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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { downloadGeneratedMedia } from '@/features/playground/lib/download-generated-media'

import {
  instantiateClipboardNodes,
  parseCanvasClipboard,
  serializeCanvasSelection,
} from '../engine/canvas-clipboard'
import { isHiddenBatchChild } from '../engine/canvas-domain'
import {
  downloadCanvasDocument,
  downloadCanvasArchive,
  exportCanvasSnapshot,
  readCanvasDocumentFile,
  readCanvasArchiveFile,
} from '../engine/canvas-export'
import { isNodeHiddenByCollapsedFrame } from '../engine/canvas-frame'
import {
  mediaKindForFile,
  mediaKindForNode,
} from '../engine/canvas-media-replacement'
import {
  captureVideoFrame,
  transformImage,
  type CropRect,
} from '../engine/canvas-media-transform'
import { useCanvasTheme } from '../engine/canvas-theme'
import { clampCanvasScale, viewportAtScale } from '../engine/canvas-viewport'
import { useCanvasGeneration } from '../hooks/use-canvas-generation'
import {
  useCanvasInteractions,
  useCanvasKeyboardShortcuts,
} from '../hooks/use-canvas-interactions'
import { useCanvasMediaImport } from '../hooks/use-canvas-media-import'
import { isGenerationNode, useCanvasStore } from '../store/canvas-store'
import {
  CanvasNodeType,
  type ContextMenuState,
  type PendingConnectionCreate,
  type Position,
} from '../types'
import { CanvasConnections } from './canvas-connections'
import { CanvasContextMenu } from './canvas-context-menu'
import { CanvasCropDialog } from './canvas-crop-dialog'
import { CanvasEmptyState, type CanvasStarterKind } from './canvas-empty-state'
import { CanvasGuide } from './canvas-guide'
import { CanvasMinimap } from './canvas-minimap'
import { CanvasNode } from './canvas-node'
import { CanvasSelectionToolbar } from './canvas-selection-toolbar'
import { CanvasToolbar } from './canvas-toolbar'
import { CanvasVersionCompare } from './canvas-version-compare'
import { InfiniteCanvas } from './infinite-canvas'

const PASTE_OFFSET = 32
const GUIDE_SEEN_KEY = 'canvas_guide_seen'

function guideAlreadySeen() {
  try {
    return window.localStorage.getItem(GUIDE_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function WorkbenchCanvas(props: { readOnly?: boolean } = {}) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replacementInputRef = useRef<HTMLInputElement>(null)
  const replacementNodeIdRef = useRef<string | null>(null)
  const clipboardRef = useRef('')
  const autoGuideRef = useRef(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [cropNodeId, setCropNodeId] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [pendingCreate, setPendingCreate] =
    useState<PendingConnectionCreate | null>(null)
  const interactions = useCanvasInteractions(containerRef, {
    readOnly: props.readOnly,
    onConnectionDropOnCanvas: (pending) => {
      setPendingCreate({
        connection: pending.connection,
        position: pending.position,
      })
      setContextMenu({
        type: 'canvas',
        x: pending.clientX,
        y: pending.clientY,
        position: pending.position,
      })
    },
  })
  const generation = useCanvasGeneration({ enabled: !props.readOnly })
  const mediaImport = useCanvasMediaImport()

  const nodes = useCanvasStore((state) => state.nodes)
  const connections = useCanvasStore((state) => state.connections)
  const viewport = useCanvasStore((state) => state.viewport)
  const backgroundMode = useCanvasStore((state) => state.backgroundMode)
  const experienceMode = useCanvasStore((state) => state.experienceMode)
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds)
  const selectedConnectionId = useCanvasStore(
    (state) => state.selectedConnectionId
  )
  const canUndo = useCanvasStore((state) => state.past.length > 0)
  const canRedo = useCanvasStore((state) => state.future.length > 0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () =>
      setViewportSize({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const focusNode = (event: Event) => {
      const nodeId = (event as CustomEvent<string>).detail
      const store = useCanvasStore.getState()
      let node = store.nodes.find((item) => item.id === nodeId)
      if (!node) return
      const parent = node.parentId
        ? store.nodes.find((item) => item.id === node?.parentId)
        : undefined
      if (parent?.metadata?.frame?.collapsed) node = parent
      store.setSelectedNodes([node.id])
      store.setViewport({
        x:
          viewportSize.width / 2 -
          (node.position.x + node.width / 2) * store.viewport.k,
        y:
          viewportSize.height / 2 -
          (node.position.y + node.height / 2) * store.viewport.k,
        k: store.viewport.k,
      })
    }
    window.addEventListener('canvas:focus-node', focusNode)
    return () => window.removeEventListener('canvas:focus-node', focusNode)
  }, [viewportSize])

  const fitView = useCallback(() => {
    useCanvasStore.getState().fitView(viewportSize)
  }, [viewportSize])

  const copySelection = useCallback(() => {
    const store = useCanvasStore.getState()
    const payload = serializeCanvasSelection(
      store.nodes,
      store.connections,
      store.selectedNodeIds
    )
    if (!payload) return
    const serialized = JSON.stringify(payload)
    clipboardRef.current = serialized
    void navigator.clipboard?.writeText?.(serialized).catch(() => undefined)
    toast.success(t('Copied {{count}} nodes', { count: payload.nodes.length }))
  }, [t])

  const pasteClipboardText = useCallback(
    (text: string, position?: Position) => {
      const payload = parseCanvasClipboard(text)
      if (!payload) return false
      const store = useCanvasStore.getState()
      const anchor = payload.nodes.reduce(
        (best, node) => ({
          x: Math.min(best.x, node.position.x),
          y: Math.min(best.y, node.position.y),
        }),
        { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }
      )
      const offset = position
        ? { x: position.x - anchor.x, y: position.y - anchor.y }
        : { x: PASTE_OFFSET, y: PASTE_OFFSET }
      const { nodes: pasted, connections: pastedConnections } =
        instantiateClipboardNodes(payload, offset)
      store.insertNodes(pasted)
      pastedConnections.forEach((connection) =>
        useCanvasStore
          .getState()
          .connectNodes(connection.fromNodeId, connection.toNodeId, {
            fromHandleId: connection.fromHandleId,
            toHandleId: connection.toHandleId,
          })
      )
      return true
    },
    []
  )

  const pasteFromSystemClipboard = useCallback(
    async (position?: Position) => {
      let text = clipboardRef.current
      try {
        const fromSystem = await navigator.clipboard?.readText?.()
        if (fromSystem) text = fromSystem
      } catch {
        // Clipboard read may be denied; fall back to the in-memory copy.
      }
      if (!text) return
      if (pasteClipboardText(text, position)) return
      mediaImport.importText(
        text,
        position ?? {
          x: (viewportSize.width / 2 - viewport.x) / viewport.k,
          y: (viewportSize.height / 2 - viewport.y) / viewport.k,
        }
      )
    },
    [mediaImport, pasteClipboardText, viewport, viewportSize]
  )

  useCanvasKeyboardShortcuts({
    onDelete: () => {
      if (props.readOnly) return
      const store = useCanvasStore.getState()
      if (store.selectedConnectionId) {
        store.removeConnection(store.selectedConnectionId)
        return
      }
      store.removeNodes(store.selectedNodeIds)
    },
    onDuplicate: () => {
      if (props.readOnly) return
      const store = useCanvasStore.getState()
      store.duplicateNodes(store.selectedNodeIds)
    },
    onFitView: fitView,
    onCopy: copySelection,
  })

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (props.readOnly) return
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      const center = {
        x: (viewportSize.width / 2 - viewport.x) / viewport.k,
        y: (viewportSize.height / 2 - viewport.y) / viewport.k,
      }
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length) {
        event.preventDefault()
        const store = useCanvasStore.getState()
        const selected = store.nodes.filter((node) =>
          store.selectedNodeIds.includes(node.id)
        )
        if (
          files.length === 1 &&
          selected.length === 1 &&
          mediaKindForFile(files[0]) === mediaKindForNode(selected[0])
        ) {
          void mediaImport.replaceNodeMedia(selected[0].id, files[0])
          return
        }
        void mediaImport.importFiles(files, center)
        return
      }
      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim()) return
      event.preventDefault()
      if (pasteClipboardText(text)) return
      mediaImport.importText(text, center)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [mediaImport, pasteClipboardText, props.readOnly, viewport, viewportSize])

  const downloadNodeMedia = useCallback(
    async (nodeId: string) => {
      const node = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      const url = node?.metadata?.content
      if (!node || !url) return
      const kindByType: Partial<
        Record<CanvasNodeType, 'image' | 'video' | 'audio'>
      > = {
        [CanvasNodeType.Video]: 'video',
        [CanvasNodeType.Audio]: 'audio',
      }
      const kind = kindByType[node.type] ?? 'image'
      try {
        await downloadGeneratedMedia(url, `${node.title || kind}`, kind)
        toast.success(t('Download started'))
      } catch {
        toast.error(t('Download failed'))
      }
    },
    [t]
  )

  const replaceTransformedImage = useCallback(
    async (nodeId: string, crop?: CropRect, turns = 0) => {
      const node = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      if (!node?.metadata?.content) return
      try {
        const file = await transformImage(node.metadata.content, crop, turns)
        await mediaImport.replaceNodeMedia(nodeId, file)
      } catch {
        toast.error(t('Image processing failed. The original was kept.'))
      }
    },
    [mediaImport, t]
  )

  const handleMediaAction = useCallback(
    async (
      nodeId: string,
      action:
        | 'preview'
        | 'copy-prompt'
        | 'rotate'
        | 'crop'
        | 'current-frame'
        | 'tail-frame'
    ) => {
      const node = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      if (!node) return
      if (action === 'copy-prompt') {
        try {
          await navigator.clipboard.writeText(node.metadata?.prompt ?? '')
          toast.success(t('Prompt copied'))
        } catch {
          toast.error(t('Copy failed'))
        }
        return
      }
      if (action === 'crop') {
        setCropNodeId(nodeId)
        return
      }
      if (action === 'rotate') {
        await replaceTransformedImage(nodeId, undefined, 1)
        return
      }
      const shell = document.querySelector(
        `[data-node-id="${CSS.escape(nodeId)}"]`
      )
      const media = shell?.querySelector('img,video') as
        | HTMLImageElement
        | HTMLVideoElement
        | null
      if (action === 'preview') {
        try {
          await media?.requestFullscreen()
        } catch {
          toast.error(t('Fullscreen preview failed'))
        }
        return
      }
      const video = media instanceof HTMLVideoElement ? media : null
      if (!video) return
      try {
        const file = await captureVideoFrame(video, action === 'tail-frame')
        await mediaImport.importFiles([file], {
          x: node.position.x + node.width + 32,
          y: node.position.y,
        })
      } catch {
        toast.error(
          t(
            'Could not capture the video frame. Check that the video allows cross-origin access.'
          )
        )
      }
    },
    [mediaImport, replaceTransformedImage, t]
  )

  const addNodeAtCenter = useCallback(
    (type: CanvasNodeType) => {
      const store = useCanvasStore.getState()
      store.addNode(type, {
        x: (viewportSize.width / 2 - store.viewport.x) / store.viewport.k,
        y: (viewportSize.height / 2 - store.viewport.y) / store.viewport.k,
      })
    },
    [viewportSize]
  )

  const startFlow = useCallback(
    (kind: CanvasStarterKind) => {
      const store = useCanvasStore.getState()
      const center = {
        x: (viewportSize.width / 2 - store.viewport.x) / store.viewport.k,
        y: (viewportSize.height / 2 - store.viewport.y) / store.viewport.k,
      }
      if (kind === 'note') {
        store.addNode(CanvasNodeType.Text, {
          x: center.x - 170,
          y: center.y - 120,
        })
        return
      }
      const image = store.addNode(CanvasNodeType.Image, {
        x: kind === 'image' ? center.x - 180 : center.x - 440,
        y: center.y - 200,
      })
      if (kind !== 'image-to-video') return
      const video = useCanvasStore
        .getState()
        .addNode(CanvasNodeType.Video, { x: center.x + 40, y: center.y - 215 })
      useCanvasStore.getState().connectNodes(image.id, video.id)
    },
    [viewportSize]
  )

  const openGuide = useCallback(() => {
    if (!useCanvasStore.getState().nodes.length) startFlow('image')
    window.requestAnimationFrame(() => setGuideOpen(true))
  }, [startFlow])

  useEffect(() => {
    window.addEventListener('canvas:start-guide', openGuide)
    return () => window.removeEventListener('canvas:start-guide', openGuide)
  }, [openGuide])

  useEffect(() => {
    if (props.readOnly || autoGuideRef.current) return
    if (!nodes.length || guideAlreadySeen()) return
    autoGuideRef.current = true
    const timer = window.setTimeout(() => setGuideOpen(true), 700)
    return () => window.clearTimeout(timer)
  }, [nodes.length, props.readOnly])

  const zoomBy = useCallback(
    (factor: number) => {
      const store = useCanvasStore.getState()
      store.setViewport(
        viewportAtScale(
          store.viewport,
          viewportSize,
          clampCanvasScale(store.viewport.k * factor)
        )
      )
    },
    [viewportSize]
  )

  const visibleNodes = nodes.filter(
    (node) =>
      !isNodeHiddenByCollapsedFrame(node, nodes) &&
      !isHiddenBatchChild(node, nodes)
  )
  let selectionAnnouncement = t('Nothing selected')
  if (selectedConnectionId) selectionAnnouncement = t('Connection selected')
  if (selectedNodeIds.length) {
    selectionAnnouncement = t('{{count}} nodes selected', {
      count: selectedNodeIds.length,
    })
  }

  return (
    <div className='relative h-full w-full' style={{ color: theme.node.text }}>
      <InfiniteCanvas
        containerRef={containerRef}
        viewport={viewport}
        backgroundMode={backgroundMode}
        onViewportChange={(next) => useCanvasStore.getState().setViewport(next)}
        onCanvasMouseDown={interactions.startSelectionBox}
        onCanvasDeselect={() => useCanvasStore.getState().clearSelection()}
        onCanvasDoubleClick={(event) => {
          if (props.readOnly) return
          const world = interactions.screenToWorld(event.clientX, event.clientY)
          useCanvasStore.getState().addNode(CanvasNodeType.Text, world)
        }}
        onContextMenu={(event) => {
          if (props.readOnly) return
          event.preventDefault()
          const target = event.target instanceof Element ? event.target : null
          const nodeId = target
            ?.closest('[data-node-id]')
            ?.getAttribute('data-node-id')
          const connectionId = target
            ?.closest('[data-connection-id]')
            ?.getAttribute('data-connection-id')
          setPendingCreate(null)
          if (nodeId) {
            useCanvasStore.getState().setSelectedNodes([nodeId])
            setContextMenu({
              type: 'node',
              x: event.clientX,
              y: event.clientY,
              nodeId,
            })
            return
          }
          if (connectionId) {
            setContextMenu({
              type: 'connection',
              x: event.clientX,
              y: event.clientY,
              connectionId,
            })
            return
          }
          setContextMenu({
            type: 'canvas',
            x: event.clientX,
            y: event.clientY,
            position: interactions.screenToWorld(event.clientX, event.clientY),
          })
        }}
        onDrop={(event) => {
          if (props.readOnly) return
          const files = [...event.dataTransfer.files]
          if (!files.length) return
          event.preventDefault()
          const targetNodeId = (event.target as Element | null)
            ?.closest('[data-node-id]')
            ?.getAttribute('data-node-id')
          const targetNode = nodes.find((node) => node.id === targetNodeId)
          if (
            files.length === 1 &&
            targetNode &&
            mediaKindForFile(files[0]) === mediaKindForNode(targetNode)
          ) {
            void mediaImport.replaceNodeMedia(targetNode.id, files[0])
            return
          }
          void mediaImport.importFiles(
            files,
            interactions.screenToWorld(event.clientX, event.clientY)
          )
        }}
      >
        <CanvasConnections
          nodes={nodes}
          connections={connections}
          selectedConnectionId={selectedConnectionId}
          pendingConnection={interactions.pendingConnection}
          readOnly={props.readOnly}
          onSelectConnection={(id) =>
            useCanvasStore.getState().setSelectedConnection(id)
          }
        />

        {visibleNodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            dragging={interactions.draggingNodeIds.includes(node.id)}
            isGenerating={generation.isNodeRunning(node.id)}
            interactions={interactions}
            readOnly={props.readOnly}
            onGenerate={generation.generateNode}
            onCancel={generation.cancelNode}
            onDownload={(id) => void downloadNodeMedia(id)}
            onReplaceMedia={(id) => {
              replacementNodeIdRef.current = id
              replacementInputRef.current?.click()
            }}
            onMediaAction={(id, action) => void handleMediaAction(id, action)}
          />
        ))}

        {interactions.selectionBox ? (
          <div
            className='pointer-events-none absolute border'
            style={{
              left: Math.min(
                interactions.selectionBox.startWorldX,
                interactions.selectionBox.currentWorldX
              ),
              top: Math.min(
                interactions.selectionBox.startWorldY,
                interactions.selectionBox.currentWorldY
              ),
              width: Math.abs(
                interactions.selectionBox.currentWorldX -
                  interactions.selectionBox.startWorldX
              ),
              height: Math.abs(
                interactions.selectionBox.currentWorldY -
                  interactions.selectionBox.startWorldY
              ),
              background: theme.canvas.selectionFill,
              borderColor: theme.accent.primary,
            }}
          />
        ) : null}

        {interactions.alignmentGuides.vertical !== undefined ? (
          <div
            className='pointer-events-none absolute'
            style={{
              left: interactions.alignmentGuides.vertical,
              top: -10000,
              width: 1,
              height: 20000,
              background: theme.accent.primary,
            }}
          />
        ) : null}
        {interactions.alignmentGuides.horizontal !== undefined ? (
          <div
            className='pointer-events-none absolute'
            style={{
              top: interactions.alignmentGuides.horizontal,
              left: -10000,
              height: 1,
              width: 20000,
              background: theme.accent.primary,
            }}
          />
        ) : null}
      </InfiniteCanvas>

      {props.readOnly ? null : (
        <CanvasToolbar
          scale={viewport.k}
          canUndo={canUndo}
          canRedo={canRedo}
          backgroundMode={backgroundMode}
          experienceMode={experienceMode}
          onBackgroundModeChange={(mode) =>
            useCanvasStore.getState().setBackgroundMode(mode)
          }
          onAddNode={addNodeAtCenter}
          onUndo={() => useCanvasStore.getState().undo()}
          onRedo={() => useCanvasStore.getState().redo()}
          onZoomIn={() => zoomBy(1.2)}
          onZoomOut={() => zoomBy(1 / 1.2)}
          onFitView={fitView}
          onExportDocument={() =>
            downloadCanvasDocument(
              useCanvasStore.getState().exportDocument(),
              t('Canvas')
            )
          }
          onExportArchive={() => {
            void downloadCanvasArchive(
              useCanvasStore.getState().exportDocument(),
              t('Canvas')
            ).catch(() => toast.error(t('Failed to export the canvas archive')))
          }}
          onImportDocument={() => fileInputRef.current?.click()}
          onExportImage={async () => {
            const ok = await exportCanvasSnapshot(visibleNodes, {
              title: t('Canvas'),
              background: theme.canvas.background,
              stroke: theme.node.stroke,
              text: theme.node.text,
            })
            if (!ok) toast.error(t('There is nothing to export'))
          }}
        />
      )}
      {props.readOnly ? null : <CanvasSelectionToolbar />}
      {props.readOnly ? null : <CanvasVersionCompare />}

      {!props.readOnly && nodes.length === 0 ? (
        <CanvasEmptyState onStart={startFlow} onShowGuide={openGuide} />
      ) : null}

      <CanvasGuide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false)
          try {
            window.localStorage.setItem(GUIDE_SEEN_KEY, '1')
          } catch {
            // Private browsing can reject writes; the guide simply replays.
          }
        }}
      />

      <input
        ref={fileInputRef}
        type='file'
        accept='application/json,.zip,application/zip'
        className='hidden'
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          let doc
          try {
            doc = file.name.toLowerCase().endsWith('.zip')
              ? await readCanvasArchiveFile(file)
              : await readCanvasDocumentFile(file)
          } catch {
            toast.error(
              t('The canvas archive is invalid or exceeds safety limits')
            )
            return
          }
          if (!doc) {
            toast.error(t('This file is not a canvas document'))
            return
          }
          useCanvasStore.getState().loadDocument(doc, { userRestore: true })
          toast.success(t('Canvas imported'))
        }}
      />
      <input
        ref={replacementInputRef}
        type='file'
        accept='image/*,video/*,audio/*'
        className='hidden'
        onChange={(event) => {
          const file = event.target.files?.[0]
          const nodeId = replacementNodeIdRef.current
          event.target.value = ''
          replacementNodeIdRef.current = null
          if (file && nodeId) void mediaImport.replaceNodeMedia(nodeId, file)
        }}
      />

      {contextMenu && !props.readOnly ? (
        <CanvasContextMenu
          state={contextMenu}
          connectMode={Boolean(pendingCreate)}
          canPaste
          canDownload={Boolean(
            contextMenu.type === 'node' &&
            nodes.find((node) => node.id === contextMenu.nodeId)?.metadata
              ?.content
          )}
          canGenerate={Boolean(
            contextMenu.type === 'node' &&
            (() => {
              const node = nodes.find((item) => item.id === contextMenu.nodeId)
              return node && isGenerationNode(node)
            })()
          )}
          onClose={() => {
            setContextMenu(null)
            setPendingCreate(null)
          }}
          actions={{
            onAddNode: (type) => {
              const store = useCanvasStore.getState()
              const position =
                contextMenu.type === 'canvas'
                  ? contextMenu.position
                  : {
                      x: (viewportSize.width / 2 - viewport.x) / viewport.k,
                      y: (viewportSize.height / 2 - viewport.y) / viewport.k,
                    }
              const node = store.addNode(type, position)
              if (!pendingCreate) return
              useCanvasStore
                .getState()
                .connectNodes(pendingCreate.connection.nodeId, node.id, {
                  firstHandleType: pendingCreate.connection.handleType,
                  fromHandleId: pendingCreate.connection.handleId,
                })
            },
            onPaste: () =>
              void pasteFromSystemClipboard(
                contextMenu.type === 'canvas' ? contextMenu.position : undefined
              ),
            onFitView: fitView,
            onCopyNode: () => {
              if (contextMenu.type !== 'node') return
              useCanvasStore.getState().setSelectedNodes([contextMenu.nodeId])
              copySelection()
            },
            onDuplicateNode: () => {
              if (contextMenu.type !== 'node') return
              useCanvasStore.getState().duplicateNodes([contextMenu.nodeId])
            },
            onDownloadNode: () => {
              if (contextMenu.type !== 'node') return
              void downloadNodeMedia(contextMenu.nodeId)
            },
            onGenerateNode: () => {
              if (contextMenu.type !== 'node') return
              void generation.generateNode(contextMenu.nodeId)
            },
            onDeleteNode: () => {
              if (contextMenu.type !== 'node') return
              useCanvasStore.getState().removeNodes([contextMenu.nodeId])
            },
            onDeleteConnection: () => {
              if (contextMenu.type !== 'connection') return
              useCanvasStore
                .getState()
                .removeConnection(contextMenu.connectionId)
            },
          }}
        />
      ) : null}

      <CanvasMinimap
        nodes={visibleNodes}
        viewport={viewport}
        viewportSize={viewportSize}
        onJump={(world) => {
          const store = useCanvasStore.getState()
          store.setViewport({
            x: viewportSize.width / 2 - world.x * store.viewport.k,
            y: viewportSize.height / 2 - world.y * store.viewport.k,
            k: store.viewport.k,
          })
        }}
      />
      <div className='sr-only' aria-live='polite'>
        {selectionAnnouncement}
      </div>
      <p className='sr-only'>
        {t(
          'Canvas instructions: Tab to nodes and connections, Enter or Space to select, arrow keys to move, and Delete to remove.'
        )}
      </p>
      <CanvasCropDialog
        source={
          nodes.find((node) => node.id === cropNodeId)?.metadata?.content ??
          null
        }
        onClose={() => setCropNodeId(null)}
        onApply={(crop) => {
          if (cropNodeId) void replaceTransformedImage(cropNodeId, crop)
          setCropNodeId(null)
        }}
      />
    </div>
  )
}
