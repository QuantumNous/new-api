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
export const MAX_IMAGE_GENERATION_COUNT = 4

export function normalizeImageGenerationCount(count: number): number {
  return Math.min(
    MAX_IMAGE_GENERATION_COUNT,
    Math.max(1, Number.isFinite(count) ? count : 1)
  )
}

export function shouldSplitImageGenerationRequests(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  return (
    normalized === 'gpt-image-2' ||
    normalized === 'codex-gpt-image-2' ||
    normalized.endsWith('-gpt-image-2')
  )
}
