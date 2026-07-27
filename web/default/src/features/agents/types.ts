/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

/** One installer in the release manifest the desktop publish pipeline writes to R2. */
export interface DesktopDownload {
  platform: 'macos' | 'windows'
  arch: string
  kind: 'dmg' | 'exe' | 'msi'
  /** Whether the installer carries an OS-trusted signature. Unsigned builds need install help. */
  signed: boolean
  minimum_os: string
  url: string
  filename: string
  size: number
  sha256: string
}

export interface DesktopRelease {
  version: string
  published_at: string
  notes: string
  downloads: DesktopDownload[]
}

export type DesktopPlatform = DesktopDownload['platform'] | 'linux'
