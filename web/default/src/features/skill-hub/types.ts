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
  icon?: string
  tags?: string[]
  verified: boolean
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

export type SkillHubForm = {
  id: string
  name: string
  description: string
  version: string
  icon: string
  tags: string[]
  verified: boolean
  published: boolean
  sort: number
  sourceType: 'zip'
  sourceUrl: string
  sourceRef: string
  sourceChecksum: string
}
