/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { CanvasNodeType, type CanvasNodeData } from '../types'

export type CanvasMediaKind = 'image' | 'video' | 'audio'

const REPLACEMENT_FIELDS = [
  'content',
  'assetId',
  'mimeType',
  'status',
  'errorDetails',
  'taskId',
  'taskStatus',
  'taskProgress',
  'naturalWidth',
  'naturalHeight',
] as const

export function mediaKindForNode(node: CanvasNodeData): CanvasMediaKind | null {
  if (node.type === CanvasNodeType.Image) return 'image'
  if (node.type === CanvasNodeType.Video) return 'video'
  if (node.type === CanvasNodeType.Audio) return 'audio'
  return null
}

export function mediaKindForFile(file: File): CanvasMediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

export function metadataForMediaReplacement(
  node: CanvasNodeData,
  uploaded: { id: number; url: string },
  mimeType: string
): NonNullable<CanvasNodeData['metadata']> {
  const metadata = { ...node.metadata }
  for (const field of REPLACEMENT_FIELDS) delete metadata[field]
  return {
    ...metadata,
    content: uploaded.url,
    assetId: uploaded.id,
    mimeType,
    status: 'success',
  }
}
