/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  deletePlaygroundAsset,
  uploadPlaygroundAsset,
} from '@/features/playground/api'
import { fetchGeneratedMedia } from '@/features/playground/lib/download-generated-media'

import {
  CanvasNodeType,
  type CanvasDocument,
  type CanvasNodeData,
} from '../types'
import {
  mediaKindForNode,
  type CanvasMediaKind,
} from './canvas-media-replacement'
import { getCanvasNodesBounds } from './canvas-viewport'

const SNAPSHOT_PADDING = 64
const SNAPSHOT_MAX_EDGE = 4096
const ZIP_FORMAT_VERSION = 1
const ZIP_MAX_FILES = 256
const ZIP_MAX_COMPRESSED_BYTES = 64 * 1024 * 1024
const ZIP_MAX_EXPANDED_BYTES = 128 * 1024 * 1024

type CanvasZipManifest = {
  formatVersion: number
  document: CanvasDocument
  media: Array<{
    nodeId: string
    path: string
    name: string
    kind: CanvasMediaKind
  }>
}

export function isSafeCanvasZipPath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\')) return false
  return path.split('/').every((part) => part && part !== '.' && part !== '..')
}

type ZipEntryWithSize = {
  dir: boolean
  name: string
  _data?: { uncompressedSize?: unknown }
}

export function canvasZipExpandedSize(
  entries: ZipEntryWithSize[]
): number | null {
  let total = 0
  for (const entry of entries) {
    if (entry.dir) continue
    const size = entry._data?.uncompressedSize
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
      return null
    }
    total += size
    if (!Number.isSafeInteger(total)) return null
  }
  return total
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function validateCanvasZipManifest(value: unknown): CanvasZipManifest {
  if (!isRecord(value) || value.formatVersion !== ZIP_FORMAT_VERSION) {
    throw new Error('archive_manifest_invalid')
  }
  const document = value.document
  const media = value.media
  if (!isRecord(document) || !Array.isArray(document.nodes)) {
    throw new Error('archive_manifest_invalid')
  }
  if (
    !Array.isArray(document.connections) ||
    !isRecord(document.viewport) ||
    !['dots', 'lines', 'blank'].includes(String(document.backgroundMode)) ||
    !['simple', 'professional'].includes(String(document.experienceMode)) ||
    !Array.isArray(media)
  ) {
    throw new Error('archive_manifest_invalid')
  }
  const finite = (candidate: unknown) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
  const nodeIds = new Set<string>()
  for (const node of document.nodes) {
    if (
      !isRecord(node) ||
      typeof node.id !== 'string' ||
      !node.id ||
      nodeIds.has(node.id) ||
      !Object.values(CanvasNodeType).includes(node.type as CanvasNodeType) ||
      typeof node.title !== 'string' ||
      !isRecord(node.position) ||
      !finite(node.position.x) ||
      !finite(node.position.y) ||
      !finite(node.width) ||
      !finite(node.height) ||
      (node.width as number) <= 0 ||
      (node.height as number) <= 0
    ) {
      throw new Error('archive_manifest_invalid')
    }
    nodeIds.add(node.id)
  }
  if (
    !finite(document.viewport.x) ||
    !finite(document.viewport.y) ||
    !finite(document.viewport.k) ||
    (document.viewport.k as number) <= 0
  ) {
    throw new Error('archive_manifest_invalid')
  }
  for (const connection of document.connections) {
    if (
      !isRecord(connection) ||
      typeof connection.id !== 'string' ||
      typeof connection.fromNodeId !== 'string' ||
      typeof connection.toNodeId !== 'string' ||
      !nodeIds.has(connection.fromNodeId) ||
      !nodeIds.has(connection.toNodeId)
    ) {
      throw new Error('archive_manifest_invalid')
    }
  }
  const mediaPaths = new Set<string>()
  const mappedNodes = new Set<string>()
  for (const item of media) {
    if (
      !isRecord(item) ||
      typeof item.nodeId !== 'string' ||
      typeof item.path !== 'string' ||
      typeof item.name !== 'string' ||
      !['image', 'video', 'audio'].includes(String(item.kind)) ||
      !isSafeCanvasZipPath(item.path) ||
      !item.path.startsWith('media/') ||
      mediaPaths.has(item.path) ||
      mappedNodes.has(item.nodeId)
    ) {
      throw new Error('archive_media_mapping_invalid')
    }
    const node = (document.nodes as CanvasNodeData[]).find(
      (candidate) => candidate.id === item.nodeId
    )
    if (!node || mediaKindForNode(node) !== item.kind) {
      throw new Error('archive_media_mapping_invalid')
    }
    mediaPaths.add(item.path)
    mappedNodes.add(item.nodeId)
  }
  return value as CanvasZipManifest
}

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

export async function downloadCanvasArchive(
  doc: CanvasDocument,
  title: string
): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const manifest: CanvasZipManifest = {
    formatVersion: ZIP_FORMAT_VERSION,
    document: structuredClone(doc),
    media: [],
  }
  for (const node of doc.nodes) {
    const kind = mediaKindForNode(node)
    const content = node.metadata?.content
    if (!kind || !content) continue
    const blob = await fetchGeneratedMedia(content)
    const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
    const path = `media/${node.id}.${extension}`
    zip.file(path, blob)
    manifest.media.push({ nodeId: node.id, path, name: node.title, kind })
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  const blob = await zip.generateAsync({ type: 'blob' })
  const safeTitle = title.trim().replaceAll(/[^\w.-]+/g, '-') || 'canvas'
  downloadBlob(blob, `${safeTitle}.zip`)
}

export async function readCanvasArchiveFile(
  file: File
): Promise<CanvasDocument> {
  if (file.size > ZIP_MAX_COMPRESSED_BYTES) {
    throw new Error('archive_size_limit')
  }
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const entries = Object.values(zip.files).filter((entry) => !entry.dir)
  if (entries.length > ZIP_MAX_FILES) throw new Error('archive_file_limit')
  if (entries.some((entry) => !isSafeCanvasZipPath(entry.name))) {
    throw new Error('archive_unsafe_path')
  }
  const declaredExpandedSize = canvasZipExpandedSize(entries)
  if (
    declaredExpandedSize === null ||
    declaredExpandedSize > ZIP_MAX_EXPANDED_BYTES
  ) {
    throw new Error('archive_size_limit')
  }
  const manifestEntry = zip.file('manifest.json')
  if (!manifestEntry) throw new Error('archive_manifest_missing')
  const manifestText = await manifestEntry.async('text')
  let expandedBytes = new Blob([manifestText]).size
  if (expandedBytes > ZIP_MAX_EXPANDED_BYTES) {
    throw new Error('archive_size_limit')
  }
  const manifest = validateCanvasZipManifest(JSON.parse(manifestText))
  for (const item of manifest.media) {
    if (!zip.file(item.path)) throw new Error('archive_media_missing')
  }
  const loadedMedia: Array<{
    item: CanvasZipManifest['media'][number]
    blob: Blob
  }> = []
  for (const item of manifest.media) {
    const entry = zip.file(item.path)
    if (!entry) throw new Error('archive_media_missing')
    const blob = await entry.async('blob')
    expandedBytes += blob.size
    if (expandedBytes > ZIP_MAX_EXPANDED_BYTES) {
      throw new Error('archive_size_limit')
    }
    loadedMedia.push({ item, blob })
  }
  const document = structuredClone(manifest.document)
  const uploadedAssetIds: number[] = []
  try {
    for (const media of loadedMedia) {
      const node = document.nodes.find((item) => item.id === media.item.nodeId)
      if (!node) throw new Error('archive_media_mapping_invalid')
      const asset = await uploadPlaygroundAsset(
        new File([media.blob], media.item.name, { type: media.blob.type }),
        media.item.kind
      )
      uploadedAssetIds.push(asset.id)
      node.metadata = {
        ...node.metadata,
        content: asset.url,
        assetId: asset.id,
        mimeType: media.blob.type,
        status: 'success',
        errorDetails: undefined,
        taskId: undefined,
        taskStatus: undefined,
        taskProgress: undefined,
      }
    }
  } catch (error) {
    await Promise.allSettled(uploadedAssetIds.map(deletePlaygroundAsset))
    throw error
  }
  return document
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
