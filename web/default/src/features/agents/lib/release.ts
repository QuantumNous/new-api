/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { DesktopDownload, DesktopPlatform, DesktopRelease } from '../types'

/** Where releases live when the deployment has not overridden it in system settings. */
export const DEFAULT_RELEASE_MANIFEST_URL =
  'https://dl.you-box.com/desktop/releases.json'

export async function fetchDesktopRelease(
  manifestUrl: string
): Promise<DesktopRelease> {
  const response = await fetch(manifestUrl, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`release manifest responded ${response.status}`)
  }
  return (await response.json()) as DesktopRelease
}

export function detectPlatform(): DesktopPlatform | null {
  if (typeof navigator === 'undefined') return null
  const signature = `${navigator.platform} ${navigator.userAgent}`.toLowerCase()
  if (signature.includes('mac')) return 'macos'
  if (signature.includes('win')) return 'windows'
  if (signature.includes('linux') || signature.includes('android'))
    return 'linux'
  return null
}

/**
 * The installer to offer first: the visitor's own platform when we ship one, otherwise the
 * first entry so the page always has something to hand out.
 */
export function primaryDownload(
  downloads: DesktopDownload[],
  platform: DesktopPlatform | null
): DesktopDownload | undefined {
  const preferred = downloads.find(
    (download) => download.platform === platform && download.kind !== 'msi'
  )
  return preferred ?? downloads.find((download) => download.kind !== 'msi')
}

export function formatSize(bytes: number): string {
  const megabytes = bytes / 1024 / 1024
  if (megabytes >= 1024) return `${(megabytes / 1024).toFixed(1)} GB`
  return `${Math.round(megabytes)} MB`
}
