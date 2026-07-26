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
Adapted and substantially modified from ddcat-ai/open-ai-canvas
web/src/components/canvas/infinite-canvas.tsx at commit
431b9e329460e44fb6e5406ea20e9863efc56ee1 (AGPL-3.0).
See NOTICE in this directory.
*/
import { useCallback, useEffect, useRef } from 'react'

import { applyLiveViewport } from './live-viewport'
import type { CanvasViewport } from './types'

type Props = {
  viewport: CanvasViewport
  onViewportChange: (viewport: CanvasViewport) => void
  onDeselect: () => void
  children: React.ReactNode
}

const clampScale = (scale: number) => Math.min(Math.max(scale, 0.1), 2.5)

export function InfiniteCanvas(props: Props) {
  const onViewportChange = props.onViewportChange
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef(props.viewport)
  const panRef = useRef<null | {
    id: number
    clientX: number
    clientY: number
    x: number
    y: number
  }>(null)
  useEffect(() => {
    viewportRef.current = props.viewport
    applyLiveViewport(containerRef.current, props.viewport)
  }, [props.viewport])

  const setViewport = useCallback(
    (next: CanvasViewport) => {
      viewportRef.current = next
      applyLiveViewport(containerRef.current, next)
      onViewportChange(next)
    },
    [onViewportChange]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('[data-canvas-no-zoom]')) return
      event.preventDefault()
      const current = viewportRef.current
      const rect = container.getBoundingClientRect()
      if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaX) > 0) {
        setViewport({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        })
        return
      }
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const scale = clampScale(current.k * Math.pow(1.1, -event.deltaY / 100))
      const worldX = (px - current.x) / current.k
      const worldY = (py - current.y) / current.k
      setViewport({ x: px - worldX * scale, y: py - worldY * scale, k: scale })
    }
    container.addEventListener('wheel', wheel, { passive: false })
    return () => container.removeEventListener('wheel', wheel)
  }, [setViewport])

  return (
    <div
      ref={containerRef}
      className='bg-muted/30 relative h-full w-full touch-none overflow-hidden'
      onPointerDown={(event) => {
        if ((event.target as Element).closest('[data-node-id]')) return
        event.currentTarget.setPointerCapture(event.pointerId)
        const current = viewportRef.current
        panRef.current = {
          id: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          x: current.x,
          y: current.y,
        }
        props.onDeselect()
      }}
      onPointerMove={(event) => {
        const pan = panRef.current
        if (!pan || pan.id !== event.pointerId) return
        setViewport({
          ...viewportRef.current,
          x: pan.x + event.clientX - pan.clientX,
          y: pan.y + event.clientY - pan.clientY,
        })
      }}
      onPointerUp={() => (panRef.current = null)}
    >
      <div
        className='pointer-events-none absolute -inset-12 opacity-50'
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in oklab, var(--muted-foreground) 35%, transparent) 1px, transparent 1px)',
          backgroundSize: 'var(--canvas-grid-size) var(--canvas-grid-size)',
          transform:
            'translate3d(var(--canvas-grid-x), var(--canvas-grid-y), 0)',
        }}
      />
      <div
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
