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
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { storyboardHandleY } from '../engine/canvas-domain'
import { resolveFrameConnection } from '../engine/canvas-frame'
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { useCanvasTheme } from '../engine/canvas-theme'
import { useCanvasStore } from '../store/canvas-store'
import type {
  CanvasConnection,
  CanvasNodeData,
  ConnectionHandle,
  Position,
} from '../types'

type CanvasConnectionsProps = {
  nodes: CanvasNodeData[]
  connections: CanvasConnection[]
  selectedConnectionId: string | null
  pendingConnection: {
    handle: ConnectionHandle
    position: Position
    targetNodeId?: string
  } | null
  onSelectConnection: (id: string) => void
  readOnly?: boolean
}

const CANVAS_PLANE = 100000
/** Screen-space SVG stroke width; keeps lines legible when zoomed far out. */
const STROKE_FLOOR_K = 0.35

function bezierPath(from: Position, to: Position) {
  const delta = Math.max(48, Math.abs(to.x - from.x) / 2)
  return `M ${from.x} ${from.y} C ${from.x + delta} ${from.y}, ${to.x - delta} ${to.y}, ${to.x} ${to.y}`
}

function sourceAnchor(node: CanvasNodeData, handleId?: string): Position {
  return {
    x: node.position.x + node.width,
    y: storyboardHandleY(node, handleId) ?? node.position.y + node.height / 2,
  }
}

function targetAnchor(node: CanvasNodeData, handleId?: string): Position {
  return {
    x: node.position.x,
    y: storyboardHandleY(node, handleId) ?? node.position.y + node.height / 2,
  }
}

type ConnectionPathProps = {
  connection: CanvasConnection
  nodes: CanvasNodeData[]
  selected: boolean
  readOnly?: boolean
  onSelect: (id: string) => void
}

const ConnectionPath = memo(function ConnectionPath(
  props: ConnectionPathProps
) {
  const { t } = useTranslation()
  const theme = useCanvasTheme()
  const [hovered, setHovered] = useState(false)
  const resolved = resolveFrameConnection(props.connection, props.nodes)
  if (!resolved) return null
  const from = sourceAnchor(resolved.from, props.connection.fromHandleId)
  const to = targetAnchor(resolved.to, props.connection.toHandleId)
  const d = bezierPath(from, to)
  const active = props.selected || hovered
  let strokeColor: string = theme.frame.stroke
  if (hovered) strokeColor = theme.accent.primarySoft
  if (props.selected) strokeColor = theme.accent.primary
  let strokeWidth = 1.75
  if (hovered) strokeWidth = 2.25
  if (props.selected) strokeWidth = 2.5

  return (
    <g data-connection-id={props.connection.id}>
      <path
        tabIndex={props.readOnly ? -1 : 0}
        role='button'
        aria-label={t('Connection from {{from}} to {{to}}', {
          from: resolved.from.title,
          to: resolved.to.title,
        })}
        d={d}
        fill='none'
        stroke='transparent'
        strokeWidth={16}
        className='pointer-events-auto cursor-pointer'
        onPointerDown={(event) => {
          if (props.readOnly) return
          event.stopPropagation()
          props.onSelect(props.connection.id)
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onKeyDown={(event) => {
          if (props.readOnly) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            props.onSelect(props.connection.id)
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            useCanvasStore.getState().removeConnection(props.connection.id)
          }
        }}
      />
      <path
        d={d}
        fill='none'
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        className='pointer-events-none transition-[stroke,stroke-width] duration-150'
        strokeLinecap='round'
      />
      {active ? (
        <circle
          cx={from.x}
          cy={from.y}
          r={2.5}
          fill={theme.accent.primary}
          className='pointer-events-none'
        />
      ) : null}
      <circle
        cx={to.x}
        cy={to.y}
        r={3.5}
        fill={active ? theme.accent.primary : theme.frame.stroke}
        className='pointer-events-none transition-[fill] duration-150'
      />
    </g>
  )
})

export function CanvasConnections(props: CanvasConnectionsProps) {
  const theme = useCanvasTheme()
  const scale = useCanvasStore((state) => state.viewport.k)
  const pending = props.pendingConnection
  const pendingNode = pending
    ? props.nodes.find((node) => node.id === pending.handle.nodeId)
    : undefined
  // Compensate far-out zoom so connections stay visible.
  const strokeScale = Math.max(1, 1 / Math.max(scale, STROKE_FLOOR_K))

  return (
    <svg
      className='pointer-events-none absolute overflow-visible'
      style={{
        left: -CANVAS_PLANE,
        top: -CANVAS_PLANE,
        width: CANVAS_PLANE * 2,
        height: CANVAS_PLANE * 2,
      }}
      viewBox={`${-CANVAS_PLANE} ${-CANVAS_PLANE} ${CANVAS_PLANE * 2} ${CANVAS_PLANE * 2}`}
    >
      <g strokeWidth={strokeScale}>
        {props.connections.map((connection) => (
          <ConnectionPath
            key={connection.id}
            connection={connection}
            nodes={props.nodes}
            selected={props.selectedConnectionId === connection.id}
            readOnly={props.readOnly}
            onSelect={props.onSelectConnection}
          />
        ))}
      </g>

      {pending && pendingNode ? (
        <path
          d={bezierPath(
            pending.handle.handleType === 'source'
              ? sourceAnchor(pendingNode, pending.handle.handleId)
              : pending.position,
            pending.handle.handleType === 'source'
              ? pending.position
              : targetAnchor(pendingNode, pending.handle.handleId)
          )}
          fill='none'
          stroke={theme.accent.primary}
          strokeWidth={2 * strokeScale}
          strokeDasharray='6 4'
          strokeLinecap='round'
          className='canvas-pending-connection pointer-events-none'
        />
      ) : null}
    </svg>
  )
}
