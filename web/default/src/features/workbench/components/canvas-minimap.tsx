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
import { useMemo } from 'react'

import { useCanvasTheme } from '../engine/canvas-theme'
import { getCanvasNodesBounds } from '../engine/canvas-viewport'
import type { CanvasNodeData, ViewportTransform } from '../types'

type CanvasMinimapProps = {
  nodes: CanvasNodeData[]
  viewport: ViewportTransform
  viewportSize: { width: number; height: number }
  onJump: (world: { x: number; y: number }) => void
}

const MINIMAP_WIDTH = 180
const MINIMAP_HEIGHT = 120
const MINIMAP_PADDING = 200

export function CanvasMinimap(props: CanvasMinimapProps) {
  const theme = useCanvasTheme()

  const projection = useMemo(() => {
    const bounds = getCanvasNodesBounds(props.nodes)
    if (!bounds) return null
    const left = bounds.left - MINIMAP_PADDING
    const top = bounds.top - MINIMAP_PADDING
    const width = bounds.right - bounds.left + MINIMAP_PADDING * 2
    const height = bounds.bottom - bounds.top + MINIMAP_PADDING * 2
    const scale = Math.min(MINIMAP_WIDTH / width, MINIMAP_HEIGHT / height)
    return { left, top, scale }
  }, [props.nodes])

  if (!projection) return null

  const viewRect = {
    x:
      (-props.viewport.x / props.viewport.k - projection.left) *
      projection.scale,
    y:
      (-props.viewport.y / props.viewport.k - projection.top) *
      projection.scale,
    width: (props.viewportSize.width / props.viewport.k) * projection.scale,
    height: (props.viewportSize.height / props.viewport.k) * projection.scale,
  }

  return (
    <div
      data-canvas-no-zoom
      className='absolute right-4 bottom-4 overflow-hidden rounded-lg border'
      style={{
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        background: theme.spatial.surface,
        borderColor: theme.toolbar.border,
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        const rect = event.currentTarget.getBoundingClientRect()
        props.onJump({
          x: (event.clientX - rect.left) / projection.scale + projection.left,
          y: (event.clientY - rect.top) / projection.scale + projection.top,
        })
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const rect = event.currentTarget.getBoundingClientRect()
        props.onJump({
          x: (event.clientX - rect.left) / projection.scale + projection.left,
          y: (event.clientY - rect.top) / projection.scale + projection.top,
        })
      }}
      onPointerUp={(event) =>
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    >
      {props.nodes.map((node) => (
        <div
          key={node.id}
          className='absolute rounded-[2px]'
          style={{
            left: (node.position.x - projection.left) * projection.scale,
            top: (node.position.y - projection.top) * projection.scale,
            width: Math.max(2, node.width * projection.scale),
            height: Math.max(2, node.height * projection.scale),
            background: theme.node.stroke,
          }}
        />
      ))}
      <div
        className='absolute border'
        style={{
          left: viewRect.x,
          top: viewRect.y,
          width: viewRect.width,
          height: viewRect.height,
          borderColor: theme.accent.primary,
          background: theme.accent.primarySoft,
        }}
      />
    </div>
  )
}
