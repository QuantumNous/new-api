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
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  calculateNodeAlignment,
  createNodeAlignmentContext,
  type NodeAlignmentContext,
} from '../engine/canvas-domain'
import {
  isNodeHiddenByCollapsedFrame,
  getFrameChildIds,
  isFrameNode,
} from '../engine/canvas-frame'
import { useCanvasStore } from '../store/canvas-store'
import type {
  CanvasNodeData,
  ConnectionHandle,
  PendingConnectionCreate,
  Position,
  SelectionBox,
  ViewportTransform,
} from '../types'

const ALIGNMENT_THRESHOLD = 6

export type AlignmentGuides = { vertical?: number; horizontal?: number }

export type CanvasInteractions = {
  selectionBox: SelectionBox | null
  pendingConnection: {
    handle: ConnectionHandle
    position: Position
    targetNodeId?: string
  } | null
  alignmentGuides: AlignmentGuides
  draggingNodeIds: string[]
  screenToWorld: (clientX: number, clientY: number) => Position
  startNodeDrag: (
    event: React.PointerEvent<HTMLElement>,
    nodeId: string
  ) => void
  startNodeResize: (
    event: React.PointerEvent<HTMLElement>,
    nodeId: string,
    corner: 'se' | 'sw' | 'ne' | 'nw'
  ) => void
  startConnection: (
    event: React.PointerEvent<HTMLElement>,
    handle: ConnectionHandle
  ) => void
  startSelectionBox: (event: React.PointerEvent<HTMLDivElement>) => void
  handleNodeSelect: (event: React.PointerEvent<HTMLElement>, id: string) => void
}

export function useCanvasInteractions(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: {
    onConnectionDropOnCanvas?: (
      pending: PendingConnectionCreate & { clientX: number; clientY: number }
    ) => void
  } = {}
): CanvasInteractions {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [pendingConnection, setPendingConnection] =
    useState<CanvasInteractions['pendingConnection']>(null)
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuides>({})
  const [draggingNodeIds, setDraggingNodeIds] = useState<string[]>([])

  const dragRef = useRef<{
    active: boolean
    pointerId: number
    startWorld: Position
    initial: Array<{ id: string; x: number; y: number }>
    alignment: NodeAlignmentContext | null
  } | null>(null)
  const resizeRef = useRef<{
    active: boolean
    pointerId: number
    nodeId: string
    corner: 'se' | 'sw' | 'ne' | 'nw'
    startWorld: Position
    initial: { x: number; y: number; width: number; height: number }
  } | null>(null)
  const connectionRef = useRef<ConnectionHandle | null>(null)

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Position => {
      const rect = containerRef.current?.getBoundingClientRect()
      const viewport = readLiveViewport(
        containerRef.current,
        useCanvasStore.getState().viewport
      )
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - viewport.x) / viewport.k,
        y: (clientY - rect.top - viewport.y) / viewport.k,
      }
    },
    [containerRef]
  )

  const handleNodeSelect = useCallback(
    (event: React.PointerEvent<HTMLElement>, id: string) => {
      const store = useCanvasStore.getState()
      const additive = event.shiftKey || event.metaKey || event.ctrlKey
      if (additive) {
        const selected = new Set(store.selectedNodeIds)
        if (selected.has(id)) selected.delete(id)
        else selected.add(id)
        store.setSelectedNodes([...selected])
        return
      }
      if (!store.selectedNodeIds.includes(id)) store.setSelectedNodes([id])
    },
    []
  )

  const startNodeDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, nodeId: string) => {
      if (event.button !== 0) return
      const store = useCanvasStore.getState()
      const node = store.nodes.find((item) => item.id === nodeId)
      if (!node || node.metadata?.locked) return
      handleNodeSelect(event, nodeId)
      event.stopPropagation()
      event.preventDefault()

      const selectedIds = new Set(useCanvasStore.getState().selectedNodeIds)
      selectedIds.add(nodeId)
      const withFrameChildren = new Set(selectedIds)
      store.nodes.forEach((item) => {
        if (!selectedIds.has(item.id) || !isFrameNode(item)) return
        getFrameChildIds(item.id, store.nodes).forEach((childId) =>
          withFrameChildren.add(childId)
        )
      })
      const movable = store.nodes.filter(
        (item) => withFrameChildren.has(item.id) && !item.metadata?.locked
      )
      if (!movable.length) return
      const initial = movable.map((item) => ({
        id: item.id,
        x: item.position.x,
        y: item.position.y,
      }))

      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startWorld: screenToWorld(event.clientX, event.clientY),
        initial,
        alignment: createNodeAlignmentContext(store.nodes, initial),
      }
      setDraggingNodeIds(initial.map((item) => item.id))
    },
    [handleNodeSelect, screenToWorld]
  )

  const startNodeResize = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      nodeId: string,
      corner: 'se' | 'sw' | 'ne' | 'nw'
    ) => {
      if (event.button !== 0) return
      const node = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      if (!node || node.metadata?.locked) return
      event.stopPropagation()
      event.preventDefault()
      resizeRef.current = {
        active: true,
        pointerId: event.pointerId,
        nodeId,
        corner,
        startWorld: screenToWorld(event.clientX, event.clientY),
        initial: {
          x: node.position.x,
          y: node.position.y,
          width: node.width,
          height: node.height,
        },
      }
    },
    [screenToWorld]
  )

  const startConnection = useCallback(
    (event: React.PointerEvent<HTMLElement>, handle: ConnectionHandle) => {
      if (event.button !== 0) return
      event.stopPropagation()
      event.preventDefault()
      connectionRef.current = handle
      setPendingConnection({
        handle,
        position: screenToWorld(event.clientX, event.clientY),
      })
    },
    [screenToWorld]
  )

  const startSelectionBox = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const store = useCanvasStore.getState()
      const world = screenToWorld(event.clientX, event.clientY)
      setSelectionBox({
        startWorldX: world.x,
        startWorldY: world.y,
        currentWorldX: world.x,
        currentWorldY: world.y,
        additive: event.shiftKey,
        subtractive: event.altKey,
        initialSelectedNodeIds: store.selectedNodeIds,
      })
    },
    [screenToWorld]
  )

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const world = screenToWorld(event.clientX, event.clientY)

      if (dragRef.current?.active) {
        const drag = dragRef.current
        const raw = {
          x: world.x - drag.startWorld.x,
          y: world.y - drag.startWorld.y,
        }
        const scale = useCanvasStore.getState().viewport.k
        const { offset, guides } = calculateNodeAlignment(
          drag.alignment,
          raw,
          ALIGNMENT_THRESHOLD / Math.max(scale, 0.05)
        )
        setAlignmentGuides(guides)
        useCanvasStore.getState().moveNodes(
          drag.initial.map((item) => ({
            id: item.id,
            x: item.x + offset.x,
            y: item.y + offset.y,
          }))
        )
        return
      }

      if (resizeRef.current?.active) {
        const resize = resizeRef.current
        const dx = world.x - resize.startWorld.x
        const dy = world.y - resize.startWorld.y
        const grows = {
          width: resize.corner.endsWith('e') ? dx : -dx,
          height: resize.corner.startsWith('s') ? dy : -dy,
        }
        const width = Math.max(160, resize.initial.width + grows.width)
        const height = Math.max(96, resize.initial.height + grows.height)
        useCanvasStore.getState().updateNode(resize.nodeId, {
          width,
          height,
          position: {
            x: resize.corner.endsWith('w')
              ? resize.initial.x + (resize.initial.width - width)
              : resize.initial.x,
            y: resize.corner.startsWith('n')
              ? resize.initial.y + (resize.initial.height - height)
              : resize.initial.y,
          },
        })
        return
      }

      if (connectionRef.current) {
        const target = (event.target as Element | null)?.closest(
          '[data-node-id]'
        )
        setPendingConnection({
          handle: connectionRef.current,
          position: world,
          targetNodeId: target?.getAttribute('data-node-id') ?? undefined,
        })
        return
      }

      setSelectionBox((box) =>
        box ? { ...box, currentWorldX: world.x, currentWorldY: world.y } : box
      )
    }

    const handleUp = (event: PointerEvent) => {
      if (dragRef.current?.active) {
        const movedIds = dragRef.current.initial.map((item) => item.id)
        dragRef.current = null
        setAlignmentGuides({})
        setDraggingNodeIds([])
        useCanvasStore.getState().commitNodeDrag(movedIds)
      }
      if (resizeRef.current?.active) resizeRef.current = null

      const handle = connectionRef.current
      if (handle) {
        connectionRef.current = null
        const targetNodeId = (event.target as Element | null)
          ?.closest('[data-node-id]')
          ?.getAttribute('data-node-id')
        const targetHandleId = (event.target as Element | null)
          ?.closest('[data-handle-id]')
          ?.getAttribute('data-handle-id')
        setPendingConnection(null)
        if (targetNodeId && targetNodeId !== handle.nodeId) {
          useCanvasStore.getState().connectNodes(handle.nodeId, targetNodeId, {
            firstHandleType: handle.handleType,
            fromHandleId: handle.handleId,
            toHandleId: targetHandleId ?? undefined,
          })
        } else if (!targetNodeId) {
          optionsRef.current.onConnectionDropOnCanvas?.({
            connection: handle,
            position: screenToWorld(event.clientX, event.clientY),
            clientX: event.clientX,
            clientY: event.clientY,
          })
        }
      }

      setSelectionBox((box) => {
        if (!box) return null
        const store = useCanvasStore.getState()
        const left = Math.min(box.startWorldX, box.currentWorldX)
        const right = Math.max(box.startWorldX, box.currentWorldX)
        const top = Math.min(box.startWorldY, box.currentWorldY)
        const bottom = Math.max(box.startWorldY, box.currentWorldY)
        const hits = store.nodes
          .filter((node) => !isNodeHiddenByCollapsedFrame(node, store.nodes))
          .filter(
            (node) =>
              node.position.x < right &&
              node.position.x + node.width > left &&
              node.position.y < bottom &&
              node.position.y + node.height > top
          )
          .map((node) => node.id)
        const selected = new Set(
          box.additive || box.subtractive ? box.initialSelectedNodeIds : []
        )
        hits.forEach((id) => {
          if (box.subtractive) selected.delete(id)
          else selected.add(id)
        })
        store.setSelectedNodes([...selected])
        return null
      })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [screenToWorld])

  return {
    selectionBox,
    pendingConnection,
    alignmentGuides,
    draggingNodeIds,
    screenToWorld,
    startNodeDrag,
    startNodeResize,
    startConnection,
    startSelectionBox,
    handleNodeSelect,
  }
}

export function useCanvasKeyboardShortcuts(options: {
  onDelete: () => void
  onDuplicate: () => void
  onFitView: () => void
  onCopy: () => void
}) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      const store = useCanvasStore.getState()
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        optionsRef.current.onDuplicate()
        return
      }
      if (modifier && event.key.toLowerCase() === 'c') {
        optionsRef.current.onCopy()
        return
      }
      if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        store.setSelectedNodes(store.nodes.map((node) => node.id))
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        optionsRef.current.onDelete()
        return
      }
      if (event.key === 'Escape') {
        store.clearSelection()
        return
      }
      if (event.key === '1' && event.shiftKey) {
        event.preventDefault()
        optionsRef.current.onFitView()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

function readLiveViewport(
  container: HTMLDivElement | null,
  fallback: ViewportTransform
): ViewportTransform {
  if (!container?.dataset.canvasViewportInteracting) return fallback
  const style = getComputedStyle(container)
  const x = Number.parseFloat(style.getPropertyValue('--canvas-live-x'))
  const y = Number.parseFloat(style.getPropertyValue('--canvas-live-y'))
  const k = Number.parseFloat(style.getPropertyValue('--canvas-live-scale'))
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(k)) {
    return fallback
  }
  return { x, y, k }
}

export function nodeIsSelected(node: CanvasNodeData, selectedIds: string[]) {
  return selectedIds.includes(node.id)
}
