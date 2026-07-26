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
  applyCanvasLiveViewport,
  subscribeCanvasViewportPreview,
} from '../engine/canvas-live-viewport'
import { useCanvasTheme } from '../engine/canvas-theme'
import { clampCanvasScale } from '../engine/canvas-viewport'
import type { CanvasBackgroundMode, ViewportTransform } from '../types'

type InfiniteCanvasProps = {
  containerRef: React.RefObject<HTMLDivElement | null>
  viewport: ViewportTransform
  backgroundMode?: CanvasBackgroundMode
  onViewportChange: (viewport: ViewportTransform) => void
  onViewportPreviewChange?: (viewport: ViewportTransform) => void
  onCanvasMouseDown?: (event: React.PointerEvent<HTMLDivElement>) => void
  onCanvasDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  onCanvasDeselect?: () => void
  onContextMenu?: (event: React.MouseEvent) => void
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void
  children: React.ReactNode
}

const WHEEL_IGNORE_SELECTOR = '[data-canvas-no-zoom],[data-canvas-wheel-scroll]'
const WHEEL_ZOOM_DELTA = 100
const TRACKPAD_PINCH_ZOOM_DELTA = 36

type TouchPoint = { x: number; y: number }

type PinchState = {
  active: boolean
  pointerIds: [number, number]
  initialDistance: number
  worldX: number
  worldY: number
  initialScale: number
}

function wheelDeltaToPixels(delta: number, deltaMode: number) {
  if (deltaMode === 1) return delta * 16
  if (deltaMode === 2) return delta * 720
  return delta
}

export function InfiniteCanvas(props: InfiniteCanvasProps) {
  const theme = useCanvasTheme()
  const containerRef = props.containerRef
  const backgroundMode = props.backgroundMode ?? 'lines'
  const onViewportChange = props.onViewportChange
  const onViewportPreviewChange = props.onViewportPreviewChange
  const onCanvasDeselect = props.onCanvasDeselect
  const panState = useRef({
    isPanning: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  })
  const viewportRef = useRef(props.viewport)
  const scaleRef = useRef(props.viewport.k)
  const containerRectRef = useRef<DOMRect | null>(null)
  const frameRef = useRef<number | null>(null)
  const nextViewportRef = useRef<ViewportTransform | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPreviewNotifyRef = useRef(0)
  const interactingRef = useRef(false)
  const touchPointsRef = useRef(new Map<number, TouchPoint>())
  const pinchStateRef = useRef<PinchState>({
    active: false,
    pointerIds: [-1, -1],
    initialDistance: 1,
    worldX: 0,
    worldY: 0,
    initialScale: props.viewport.k,
  })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    if (interactingRef.current) return
    viewportRef.current = props.viewport
    scaleRef.current = props.viewport.k
    applyCanvasLiveViewport(containerRef.current, props.viewport)
  }, [containerRef, props.viewport])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    return subscribeCanvasViewportPreview(container, (next) => {
      viewportRef.current = next
      scaleRef.current = next.k
    })
  }, [containerRef])

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      delete containerRef.current?.dataset.canvasViewportInteracting
    },
    [containerRef]
  )

  const syncViewport = useCallback(
    () => onViewportChange(viewportRef.current),
    [onViewportChange]
  )

  const scheduleViewportChange = useCallback(
    (next: ViewportTransform, commitAfterIdle = false) => {
      viewportRef.current = next
      scaleRef.current = next.k
      onViewportPreviewChange?.(next)
      const container = containerRef.current
      if (container) container.dataset.canvasViewportInteracting = 'true'
      nextViewportRef.current = next
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame((now) => {
          frameRef.current = null
          const pending = nextViewportRef.current
          if (!pending) return
          const notify = now - lastPreviewNotifyRef.current >= 32
          applyCanvasLiveViewport(containerRef.current, pending, notify)
          if (notify) lastPreviewNotifyRef.current = now
        })
      }
      if (!commitAfterIdle) return
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(() => {
        interactingRef.current = false
        delete containerRef.current?.dataset.canvasViewportInteracting
        syncViewport()
        syncTimerRef.current = null
      }, 120)
    },
    [containerRef, onViewportPreviewChange, syncViewport]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      setIsSpacePressed(true)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const deltaX = wheelDeltaToPixels(event.deltaX, event.deltaMode)
      const deltaY = wheelDeltaToPixels(event.deltaY, event.deltaMode)
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      const isPinchZoom = event.ctrlKey || event.metaKey
      if (target?.closest(WHEEL_IGNORE_SELECTOR)) {
        // Keep inner vertical scrolling, but never let a horizontal gesture
        // leak out as browser back/forward navigation.
        if (!isPinchZoom && (event.shiftKey || absX > absY)) {
          event.preventDefault()
        }
        return
      }

      event.preventDefault()
      interactingRef.current = true
      const current = viewportRef.current
      const rawAbsY = Math.abs(event.deltaY)
      const looksLikeMouseWheel =
        event.deltaMode !== 0 ||
        (rawAbsY >= 80 &&
          Math.abs(rawAbsY - Math.round(rawAbsY / 100) * 100) < 1)
      const looksLikeTrackpadPan =
        !isPinchZoom &&
        (event.shiftKey || absX > 0 || (!looksLikeMouseWheel && absY > 0))

      if (looksLikeTrackpadPan) {
        const panX = event.shiftKey && absX < 1 ? deltaY : deltaX
        scheduleViewportChange(
          {
            x: current.x - panX,
            y: current.y - (event.shiftKey && absX < 1 ? 0 : deltaY),
            k: current.k,
          },
          true
        )
        return
      }

      const rect =
        containerRectRef.current ||
        containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      const zoomDelta =
        isPinchZoom && !looksLikeMouseWheel
          ? TRACKPAD_PINCH_ZOOM_DELTA
          : WHEEL_ZOOM_DELTA
      const factor = Math.pow(1.1, -deltaY / zoomDelta)
      const newScale = clampCanvasScale(current.k * factor)
      const worldX = (mouseX - current.x) / current.k
      const worldY = (mouseY - current.y) / current.k

      scheduleViewportChange(
        {
          x: mouseX - worldX * newScale,
          y: mouseY - worldY * newScale,
          k: newScale,
        },
        true
      )
    },
    [containerRef, scheduleViewportChange]
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-canvas-no-zoom]')) return
    if (target?.closest('[data-connection-create-menu]')) return
    const isBackgroundClick = !target?.closest(
      '[data-node-id],[data-connection-id]'
    )
    const isTouch = event.pointerType === 'touch'
    const hasSelectionModifier =
      event.shiftKey || event.ctrlKey || event.metaKey || event.altKey

    if (
      event.button === 0 &&
      !isSpacePressed &&
      !isTouch &&
      isBackgroundClick &&
      hasSelectionModifier
    ) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      props.onCanvasMouseDown?.(event)
      return
    }

    if (isTouch) {
      touchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      if (touchPointsRef.current.size >= 2) {
        const [[firstId, first], [secondId, second]] = [
          ...touchPointsRef.current.entries(),
        ]
        event.preventDefault()
        event.currentTarget.setPointerCapture(firstId)
        event.currentTarget.setPointerCapture(secondId)
        const rect =
          containerRectRef.current ||
          event.currentTarget.getBoundingClientRect()
        const current = viewportRef.current
        const centerX = (first.x + second.x) / 2 - rect.left
        const centerY = (first.y + second.y) / 2 - rect.top
        pinchStateRef.current = {
          active: true,
          pointerIds: [firstId, secondId],
          initialDistance: Math.max(
            Math.hypot(second.x - first.x, second.y - first.y),
            1
          ),
          worldX: (centerX - current.x) / current.k,
          worldY: (centerY - current.y) / current.k,
          initialScale: current.k,
        }
        panState.current.isPanning = false
        interactingRef.current = true
        return
      }
      if (!isBackgroundClick) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      if (!event.isPrimary) return
    } else if (
      !isBackgroundClick ||
      (event.button !== 0 && event.button !== 1)
    ) {
      return
    } else {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    const current = viewportRef.current
    interactingRef.current = true
    panState.current = {
      isPanning: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: current.x,
      initialY: current.y,
      hasMoved: false,
    }
    setIsPanning(true)
    document.body.style.cursor = 'grabbing'
  }

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (
        event.pointerType === 'touch' &&
        touchPointsRef.current.has(event.pointerId)
      ) {
        touchPointsRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
        const pinch = pinchStateRef.current
        if (pinch.active) {
          const first = touchPointsRef.current.get(pinch.pointerIds[0])
          const second = touchPointsRef.current.get(pinch.pointerIds[1])
          const rect =
            containerRectRef.current ||
            containerRef.current?.getBoundingClientRect()
          if (!first || !second || !rect) return
          event.preventDefault()
          const centerX = (first.x + second.x) / 2 - rect.left
          const centerY = (first.y + second.y) / 2 - rect.top
          const distance = Math.max(
            Math.hypot(second.x - first.x, second.y - first.y),
            1
          )
          const scale = clampCanvasScale(
            pinch.initialScale * (distance / pinch.initialDistance)
          )
          scheduleViewportChange({
            x: centerX - pinch.worldX * scale,
            y: centerY - pinch.worldY * scale,
            k: scale,
          })
          return
        }
      }

      if (
        !panState.current.isPanning ||
        panState.current.pointerId !== event.pointerId
      ) {
        return
      }
      const dx = event.clientX - panState.current.startX
      const dy = event.clientY - panState.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        panState.current.hasMoved = true
      }
      scheduleViewportChange({
        x: panState.current.initialX + dx,
        y: panState.current.initialY + dy,
        k: scaleRef.current,
      })
    }

    const finishInteraction = () => {
      panState.current.isPanning = false
      panState.current.pointerId = -1
      interactingRef.current = false
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      delete containerRef.current?.dataset.canvasViewportInteracting
      syncViewport()
      setIsPanning(false)
      document.body.style.cursor = 'default'
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (
        event.pointerType === 'touch' &&
        pinchStateRef.current.active &&
        pinchStateRef.current.pointerIds.includes(event.pointerId)
      ) {
        pinchStateRef.current.active = false
        touchPointsRef.current.clear()
        finishInteraction()
        return
      }
      if (event.pointerType === 'touch') {
        touchPointsRef.current.delete(event.pointerId)
      }
      if (
        !panState.current.isPanning ||
        panState.current.pointerId !== event.pointerId
      ) {
        return
      }
      if (event.type === 'pointerup' && !panState.current.hasMoved) {
        onCanvasDeselect?.()
      }
      finishInteraction()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [containerRef, onCanvasDeselect, scheduleViewportChange, syncViewport])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateRect = () => {
      containerRectRef.current = container.getBoundingClientRect()
    }
    updateRect()
    const observer = new ResizeObserver(updateRect)
    observer.observe(container)
    window.addEventListener('resize', updateRect)
    container.addEventListener('wheel', handleWheel, {
      passive: false,
      capture: true,
    })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
      container.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [containerRef, handleWheel])

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full touch-none overflow-hidden select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={
        {
          background: theme.canvas.background,
          overscrollBehavior: 'none',
          '--canvas-live-x': `${props.viewport.x}px`,
          '--canvas-live-y': `${props.viewport.y}px`,
          '--canvas-live-scale': props.viewport.k,
          '--canvas-grid-size': `${48 * props.viewport.k}px`,
          '--canvas-grid-x': `${props.viewport.x % (48 * props.viewport.k)}px`,
          '--canvas-grid-y': `${props.viewport.y % (48 * props.viewport.k)}px`,
          '--canvas-dot-size': props.viewport.k < 0.12 ? '0.8px' : '1.15px',
        } as React.CSSProperties
      }
      onPointerDown={handlePointerDown}
      onDoubleClick={(event) => {
        const target = event.target instanceof Element ? event.target : null
        if (
          !target?.closest(
            '[data-node-id],[data-connection-id],[data-canvas-no-zoom]'
          )
        ) {
          props.onCanvasDoubleClick?.(event)
        }
      }}
      onContextMenu={props.onContextMenu}
      onDragOver={(event) => event.preventDefault()}
      onDrop={props.onDrop}
    >
      <CanvasGrid mode={backgroundMode} />
      <div
        data-canvas-world-layer
        className='absolute origin-top-left'
        style={{
          transform:
            'translate3d(var(--canvas-live-x), var(--canvas-live-y), 0) scale(var(--canvas-live-scale))',
          willChange: 'transform',
        }}
      >
        {props.children}
      </div>
    </div>
  )
}

function CanvasGrid(props: { mode: CanvasBackgroundMode }) {
  const theme = useCanvasTheme()
  if (props.mode === 'blank') return null
  const backgroundImage =
    props.mode === 'dots'
      ? `radial-gradient(circle, ${theme.canvas.dot} var(--canvas-dot-size), transparent calc(var(--canvas-dot-size) + 0.2px))`
      : `linear-gradient(${theme.canvas.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.canvas.line} 1px, transparent 1px)`

  return (
    <div
      data-canvas-grid-layer
      className='pointer-events-none absolute opacity-40'
      style={{
        inset: 'calc(-1 * var(--canvas-grid-size))',
        backgroundImage,
        backgroundSize: 'var(--canvas-grid-size) var(--canvas-grid-size)',
        transform: 'translate3d(var(--canvas-grid-x), var(--canvas-grid-y), 0)',
        willChange: 'transform',
      }}
    />
  )
}
