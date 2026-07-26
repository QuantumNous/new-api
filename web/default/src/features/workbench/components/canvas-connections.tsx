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
import { storyboardHandleY } from '../engine/canvas-domain'
import { resolveFrameConnection } from '../engine/canvas-frame'
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { useCanvasTheme } from '../engine/canvas-theme'
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
}

const CANVAS_PLANE = 100000

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

export function CanvasConnections(props: CanvasConnectionsProps) {
  const theme = useCanvasTheme()
  const pending = props.pendingConnection
  const pendingNode = pending
    ? props.nodes.find((node) => node.id === pending.handle.nodeId)
    : undefined

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
      {props.connections.map((connection) => {
        const resolved = resolveFrameConnection(connection, props.nodes)
        if (!resolved) return null
        const from = sourceAnchor(resolved.from, connection.fromHandleId)
        const to = targetAnchor(resolved.to, connection.toHandleId)
        const selected = props.selectedConnectionId === connection.id
        return (
          <g key={connection.id} data-connection-id={connection.id}>
            <path
              d={bezierPath(from, to)}
              fill='none'
              stroke='transparent'
              strokeWidth={16}
              className='pointer-events-auto cursor-pointer'
              onPointerDown={(event) => {
                event.stopPropagation()
                props.onSelectConnection(connection.id)
              }}
            />
            <path
              d={bezierPath(from, to)}
              fill='none'
              stroke={selected ? theme.accent.primary : theme.frame.stroke}
              strokeWidth={selected ? 2.5 : 1.75}
            />
            <circle cx={to.x} cy={to.y} r={3.5} fill={theme.accent.primary} />
          </g>
        )
      })}

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
          strokeWidth={2}
          strokeDasharray='6 4'
        />
      ) : null}
    </svg>
  )
}
