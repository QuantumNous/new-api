/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  CanvasNodeType,
  type CanvasDocument,
  type CanvasNodeData,
} from '../types'
import { getCanvasNodesBounds } from './canvas-viewport'

const SNAPSHOT_PADDING = 64
const SNAPSHOT_MAX_EDGE = 4096

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCanvasDocument(doc: CanvasDocument, title: string) {
  const safeTitle = title.trim().replaceAll(/[^\w.-]+/g, '-') || 'canvas'
  downloadBlob(
    new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    `${safeTitle}.json`
  )
}

export async function readCanvasDocumentFile(
  file: File
): Promise<Partial<CanvasDocument> | null> {
  try {
    const parsed = JSON.parse(await file.text()) as Partial<CanvasDocument>
    if (!Array.isArray(parsed?.nodes)) return null
    return {
      nodes: parsed.nodes,
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      viewport: parsed.viewport,
      backgroundMode: parsed.backgroundMode,
    }
  } catch {
    return null
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => resolve(null))
    image.src = src
  })
}

/**
 * Renders the canvas nodes into a flat PNG. Media that cannot be read due to
 * cross-origin rules degrades to its placeholder rectangle.
 */
export async function exportCanvasSnapshot(
  nodes: CanvasNodeData[],
  options: { title: string; background: string; stroke: string; text: string }
): Promise<boolean> {
  const bounds = getCanvasNodesBounds(nodes)
  if (!bounds) return false

  const width = bounds.right - bounds.left + SNAPSHOT_PADDING * 2
  const height = bounds.bottom - bounds.top + SNAPSHOT_PADDING * 2
  const scale = Math.min(1, SNAPSHOT_MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) return false

  context.fillStyle = options.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.scale(scale, scale)
  context.translate(
    SNAPSHOT_PADDING - bounds.left,
    SNAPSHOT_PADDING - bounds.top
  )

  for (const node of nodes) {
    context.fillStyle = 'rgba(127,127,127,0.08)'
    context.strokeStyle = options.stroke
    context.lineWidth = 1
    context.fillRect(node.position.x, node.position.y, node.width, node.height)
    context.strokeRect(
      node.position.x,
      node.position.y,
      node.width,
      node.height
    )

    const content = node.metadata?.content
    if (node.type === CanvasNodeType.Image && content) {
      const image = await loadImageElement(content)
      if (image) {
        context.drawImage(
          image,
          node.position.x,
          node.position.y,
          node.width,
          node.height
        )
        continue
      }
    }

    context.fillStyle = options.text
    context.font = '14px sans-serif'
    context.fillText(
      node.title,
      node.position.x + 10,
      node.position.y + 22,
      node.width - 20
    )
    if (node.type === CanvasNodeType.Text && content) {
      context.font = '12px sans-serif'
      context.fillText(
        content.slice(0, 120),
        node.position.x + 10,
        node.position.y + 44,
        node.width - 20
      )
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), 'image/png')
  )
  if (!blob) return false
  const safeTitle =
    options.title.trim().replaceAll(/[^\w.-]+/g, '-') || 'canvas'
  downloadBlob(blob, `${safeTitle}.png`)
  return true
}
