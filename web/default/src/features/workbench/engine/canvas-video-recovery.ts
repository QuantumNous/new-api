/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { CanvasNodeType, type CanvasNodeData } from '../types'

export function shouldRecoverCanvasVideoTask(
  node: CanvasNodeData,
  activeNodeIds: ReadonlySet<string>,
  stoppedNodeIds: ReadonlySet<string>
): boolean {
  const status = node.metadata?.taskStatus
  return Boolean(
    node.type === CanvasNodeType.Video &&
    node.metadata?.taskId &&
    status !== 'SUCCESS' &&
    status !== 'FAILURE' &&
    !activeNodeIds.has(node.id) &&
    !stoppedNodeIds.has(node.id)
  )
}
