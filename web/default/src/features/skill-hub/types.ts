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
export type SkillHubSkill = {
  id: string
  name: string
  description?: string
  version: string
  author?: string
  icon?: string
  tags?: string[]
  verified: boolean
  recommended: boolean
  published?: boolean
  status?: number
  sort?: number
  updatedAt?: string
  source?: {
    type: 'zip'
    url?: string
    ref?: string
    checksum?: string
  }
}

export type SkillHubListResponse = {
  success: boolean
  message?: string
  data?: {
    items: SkillHubSkill[]
    total: number
  }
}

export type SkillHubSkillResponse = {
  success: boolean
  message?: string
  data?: SkillHubSkill
}

export type SkillHubTag = {
  id: number
  name: string
  sort?: number
  usageCount: number
  createdAt?: string
  updatedAt?: string
}

export type SkillHubTagListResponse = {
  success: boolean
  message?: string
  data?: {
    items: SkillHubTag[]
    total: number
  }
}

export type SkillHubTagResponse = {
  success: boolean
  message?: string
  data?: SkillHubTag
}

export type SkillHubDirectUploadInitResponse = {
  success: boolean
  message?: string
  data?: {
    kind: 'zip' | 'icon'
    fileName: string
    object: string
    size: number
    contentType: string
    uploadUrl: string
    uploadMethod: 'PUT'
    uploadHeaders: Record<string, string>
    uploadTicket: string
    expiresAt: number
  }
}

export type SkillHubUploadResponse = {
  success: boolean
  message?: string
  data?: {
    url: string
    object: string
    size: number
    checksum: string
    uploadTicket?: string
  }
}

export type SkillHubForm = {
  id: string
  name: string
  description: string
  version: string
  author: string
  icon: string
  tags: string[]
  verified: boolean
  recommended: boolean
  published: boolean
  sort: number
  sourceType: 'zip'
  sourceUrl: string
  sourceRef: string
  sourceChecksum: string
}
