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
export type ClientRelease = {
  id: number
  version: string
  platform: ClientReleasePlatform
  arch: ClientReleaseArch
  channel: ClientReleaseChannel
  fileName: string
  objectKey?: string
  downloadUrl?: string
  size: number
  sha256?: string
  sha512?: string
  releaseNotes?: string
  minVersion?: string
  forced: boolean
  published?: boolean
  status?: number
  createdAt?: string
  updatedAt?: string
}

export type ClientReleasePlatform = 'windows' | 'darwin' | 'linux'

export type ClientReleaseArch = 'x64' | 'arm64' | 'ia32' | 'universal'

export type ClientReleaseChannel = 'stable' | 'beta'

export type ClientReleaseForm = {
  version: string
  platform: ClientReleasePlatform
  arch: ClientReleaseArch
  channel: ClientReleaseChannel
  fileName: string
  objectKey: string
  size: number
  sha256: string
  sha512: string
  releaseNotes: string
  minVersion: string
  forced: boolean
  published: boolean
}

export type ClientReleaseListResponse = {
  success: boolean
  message?: string
  data?: {
    items: ClientRelease[]
    total: number
  }
}

export type ClientReleaseResponse = {
  success: boolean
  message?: string
  data?: ClientRelease
}

export type ClientReleaseUploadResponse = {
  success: boolean
  message?: string
  data?: {
    fileName: string
    object: string
    size: number
    sha256: string
    sha512: string
  }
}
