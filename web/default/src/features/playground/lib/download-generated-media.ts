/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { getCommonHeaders } from '@/lib/api'

import {
  importPlaygroundAsset,
  type PlaygroundAsset,
  uploadPlaygroundAsset,
} from '../api'

type DownloadableMediaKind = 'image' | 'video' | 'audio'

const SAME_ORIGIN_DOWNLOADABLE =
  /(?:\/api\/playground\/assets\/\d+\/content|\/v1\/videos\/[^/?#]+\/content)(?:\?|$)/

const EXTENSIONS: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

const DEFAULT_EXTENSIONS: Record<DownloadableMediaKind, string> = {
  audio: 'mp3',
  image: 'png',
  video: 'mp4',
}

export function generatedMediaExtension(
  mimeType: string,
  kind: DownloadableMediaKind
): string {
  const normalizedMime = mimeType.split(';', 1)[0].toLowerCase()
  return EXTENSIONS[normalizedMime] ?? DEFAULT_EXTENSIONS[kind]
}

function withDownloadParam(url: string): string {
  return url.includes('?') ? `${url}&download=1` : `${url}?download=1`
}

function mediaFetchHeaders(url: string): HeadersInit | undefined {
  // Same-origin private streams may still sit behind UserAuth on other
  // endpoints; attach New-Api-User when available. Session cookie alone is
  // enough for /assets/:id/content (UserSessionAuth).
  if (!SAME_ORIGIN_DOWNLOADABLE.test(url) && !url.includes('/api/')) {
    return undefined
  }
  const headers = getCommonHeaders()
  delete headers['Content-Type']
  return headers
}

export async function fetchGeneratedMedia(sourceUrl: string): Promise<Blob> {
  let fetchUrl = sourceUrl
  // Force attachment stream on same-origin media endpoints so browsers get a
  // CORS-readable body (no cross-origin R2 redirect).
  if (SAME_ORIGIN_DOWNLOADABLE.test(sourceUrl)) {
    fetchUrl = withDownloadParam(sourceUrl)
  }
  const response = await fetch(fetchUrl, {
    credentials: 'include',
    headers: mediaFetchHeaders(sourceUrl),
  })
  if (!response.ok) {
    throw new Error(`Media download failed (${response.status})`)
  }
  return response.blob()
}

export async function persistGeneratedMediaAsset(
  sourceUrl: string,
  filename: string,
  kind: DownloadableMediaKind
): Promise<PlaygroundAsset> {
  try {
    const blob = await fetchGeneratedMedia(sourceUrl)
    return uploadPlaygroundAsset(
      new File([blob], filename, { type: blob.type }),
      kind
    )
  } catch (error) {
    if (!/^https?:\/\//i.test(sourceUrl)) throw error
    return importPlaygroundAsset(sourceUrl, kind)
  }
}

export async function downloadGeneratedMedia(
  sourceUrl: string,
  baseFilename: string,
  kind: DownloadableMediaKind
): Promise<void> {
  let blob: Blob
  try {
    blob = await fetchGeneratedMedia(sourceUrl)
  } catch (error) {
    // External provider URLs often block browser CORS; import server-side then
    // stream the stored asset.
    if (!/^https?:\/\//i.test(sourceUrl)) throw error
    const asset = await importPlaygroundAsset(sourceUrl, kind)
    blob = await fetchGeneratedMedia(asset.url)
  }

  const extension = generatedMediaExtension(blob.type, kind)
  const filename = baseFilename.endsWith(`.${extension}`)
    ? baseFilename
    : `${baseFilename}.${extension}`
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
