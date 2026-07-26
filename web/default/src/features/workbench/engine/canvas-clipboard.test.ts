/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import {
  CanvasNodeType,
  type CanvasConnection,
  type CanvasNodeData,
} from '../types'
import {
  CANVAS_CLIPBOARD_KIND,
  instantiateClipboardNodes,
  parseCanvasClipboard,
  serializeCanvasSelection,
} from './canvas-clipboard'
import { createStoryboardRow } from './canvas-domain'

function node(
  id: string,
  type: CanvasNodeType,
  extra: Partial<CanvasNodeData> = {}
): CanvasNodeData {
  return {
    id,
    type,
    title: id,
    position: { x: 0, y: 0 },
    width: 200,
    height: 200,
    ...extra,
  }
}

const connection = (
  id: string,
  fromNodeId: string,
  toNodeId: string,
  handles: Partial<CanvasConnection> = {}
): CanvasConnection => ({ id, fromNodeId, toNodeId, ...handles })

describe('serializeCanvasSelection', () => {
  it('returns null when nothing is selected', () => {
    expect(
      serializeCanvasSelection([node('a', CanvasNodeType.Text)], [], [])
    ).toBeNull()
  })

  it('includes batch children and only inner connections', () => {
    const nodes = [
      node('root', CanvasNodeType.Image, {
        metadata: { isBatchRoot: true, batchChildIds: ['child'] },
      }),
      node('child', CanvasNodeType.Image, {
        metadata: { batchRootId: 'root' },
      }),
      node('outside', CanvasNodeType.Text),
    ]
    const connections = [
      connection('c1', 'root', 'child'),
      connection('c2', 'outside', 'root'),
    ]
    const payload = serializeCanvasSelection(nodes, connections, ['root'])
    expect(payload?.nodes.map((item) => item.id)).toEqual(['root', 'child'])
    expect(payload?.connections.map((item) => item.id)).toEqual(['c1'])
  })

  it('includes frame descendants and their internal connections', () => {
    const frame = node('frame', CanvasNodeType.Frame)
    const child = node('child', CanvasNodeType.Text, { parentId: frame.id })
    const payload = serializeCanvasSelection(
      [frame, child],
      [
        connection('inside', frame.id, child.id, {
          fromHandleId: 'out',
          toHandleId: 'in',
        }),
      ],
      [frame.id]
    )
    expect(payload?.nodes).toHaveLength(2)
    expect(payload?.connections).toHaveLength(1)
    if (!payload) return
    const copy = instantiateClipboardNodes(payload, { x: 10, y: 10 })
    const copiedFrame = copy.nodes.find((item) => item.title === 'frame')
    const copiedChild = copy.nodes.find((item) => item.title === 'child')
    expect(copiedChild?.parentId).toBe(copiedFrame?.id)
    expect(copy.connections[0]).toMatchObject({
      fromHandleId: 'out',
      toHandleId: 'in',
    })
  })
})

describe('parseCanvasClipboard', () => {
  it('rejects foreign payloads', () => {
    expect(parseCanvasClipboard('not json')).toBeNull()
    expect(parseCanvasClipboard(JSON.stringify({ kind: 'other' }))).toBeNull()
    expect(
      parseCanvasClipboard(
        JSON.stringify({ kind: CANVAS_CLIPBOARD_KIND, nodes: [] })
      )
    ).toBeNull()
  })

  it('accepts a serialized selection', () => {
    const payload = serializeCanvasSelection(
      [node('a', CanvasNodeType.Text)],
      [],
      ['a']
    )
    expect(parseCanvasClipboard(JSON.stringify(payload))?.nodes).toHaveLength(1)
  })
})

describe('instantiateClipboardNodes', () => {
  it('remaps ids, offsets positions and rewrites internal references', () => {
    const row = createStoryboardRow(1, { imageNodeId: 'image-1' })
    const payload = serializeCanvasSelection(
      [
        node('script-1', CanvasNodeType.Script, {
          metadata: {
            storyboard: { rows: [row], referenceNodeIds: ['image-1'] },
          },
        }),
        node('image-1', CanvasNodeType.Image, { position: { x: 40, y: 60 } }),
      ],
      [
        connection('c1', 'script-1', 'image-1', {
          fromHandleId: `row:${row.id}`,
        }),
      ],
      ['script-1', 'image-1']
    )
    expect(payload).not.toBeNull()
    if (!payload) return
    const result = instantiateClipboardNodes(payload, { x: 10, y: 20 })

    const [script, image] = result.nodes
    expect(script.id).not.toBe('script-1')
    expect(image.position).toEqual({ x: 50, y: 80 })

    const nextRow = script.metadata?.storyboard?.rows[0]
    expect(nextRow?.id).not.toBe(row.id)
    expect(nextRow?.imageNodeId).toBe(image.id)
    expect(script.metadata?.storyboard?.referenceNodeIds).toEqual([image.id])

    expect(result.connections[0].fromNodeId).toBe(script.id)
    expect(result.connections[0].toNodeId).toBe(image.id)
    expect(result.connections[0].fromHandleId).toBe(`row:${nextRow?.id}`)
  })

  it('copies a complete frame with a valid internal version family', () => {
    const frame = node('frame', CanvasNodeType.Frame)
    const primary = node('image-a', CanvasNodeType.Image, {
      parentId: frame.id,
      metadata: {
        versionRootId: 'external-family',
        versionLabel: 'C',
        versionPrimary: false,
      },
    })
    const payload = serializeCanvasSelection([frame, primary], [], [frame.id])
    if (!payload) throw new Error('selection was not serialized')
    const copy = instantiateClipboardNodes(payload, { x: 0, y: 0 })
    const copiedImage = copy.nodes.find(
      (item) => item.type === CanvasNodeType.Image
    )
    expect(copiedImage?.metadata).toMatchObject({
      versionRootId: copiedImage?.id,
      versionLabel: 'A',
      versionPrimary: true,
    })
    expect(copiedImage?.parentId).toBe(
      copy.nodes.find((item) => item.type === CanvasNodeType.Frame)?.id
    )
  })

  it('clears live task and storyboard execution state from copied nodes', () => {
    const row = createStoryboardRow(1, {
      status: 'loading',
      errorDetails: 'in progress',
    })
    const payload = serializeCanvasSelection(
      [
        node('video', CanvasNodeType.Video, {
          metadata: {
            content: '/video.mp4',
            status: 'loading',
            taskId: 'task-original',
            taskStatus: 'RUNNING',
            taskProgress: 42,
            errorDetails: 'old error',
          },
        }),
        node('script', CanvasNodeType.Script, {
          metadata: {
            status: 'loading',
            storyboard: {
              rows: [row],
              referenceNodeIds: [],
              batch: {
                id: 'active-batch',
                kind: 'video',
                stopped: false,
                items: [{ rowId: row.id, status: 'running' }],
              },
            },
          },
        }),
      ],
      [],
      ['video', 'script']
    )
    if (!payload) throw new Error('selection was not serialized')

    const copy = instantiateClipboardNodes(payload, { x: 0, y: 0 })
    const video = copy.nodes.find((item) => item.type === CanvasNodeType.Video)
    const script = copy.nodes.find(
      (item) => item.type === CanvasNodeType.Script
    )

    expect(video?.metadata).toMatchObject({ status: 'success' })
    expect(video?.metadata?.taskId).toBeUndefined()
    expect(video?.metadata?.taskStatus).toBeUndefined()
    expect(video?.metadata?.taskProgress).toBeUndefined()
    expect(video?.metadata?.errorDetails).toBeUndefined()
    expect(script?.metadata?.status).toBe('idle')
    expect(script?.metadata?.storyboard?.batch).toBeUndefined()
    expect(script?.metadata?.storyboard?.rows[0]).toMatchObject({
      status: 'idle',
    })
    expect(script?.metadata?.storyboard?.rows[0].errorDetails).toBeUndefined()
  })
})
