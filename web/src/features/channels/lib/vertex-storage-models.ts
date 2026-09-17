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
export const VERTEX_STORAGE_MODEL_PREFIX = 'storage:gs:'

export type VertexStorageModelParts = {
  models: string[]
  buckets: string[]
}

const INVALID_BUCKET_CHARACTERS = /[\\/?#]/

export function normalizeVertexStorageBucket(value: string): string | null {
  const bucket = value.trim()
  if (!bucket || bucket === '.' || bucket === '..') return null
  if (bucket.startsWith(VERTEX_STORAGE_MODEL_PREFIX)) return null
  if (bucket.includes('://') || INVALID_BUCKET_CHARACTERS.test(bucket)) {
    return null
  }
  return bucket
}

export function splitVertexStorageModels(
  values: string[]
): VertexStorageModelParts {
  const models: string[] = []
  const buckets: string[] = []
  const seenModels = new Set<string>()
  const seenBuckets = new Set<string>()

  for (const rawValue of values) {
    const value = rawValue.trim()
    if (!value) continue

    if (value.startsWith(VERTEX_STORAGE_MODEL_PREFIX)) {
      const bucket = normalizeVertexStorageBucket(
        value.slice(VERTEX_STORAGE_MODEL_PREFIX.length)
      )
      if (bucket && !seenBuckets.has(bucket)) {
        seenBuckets.add(bucket)
        buckets.push(bucket)
      }
      continue
    }

    if (!seenModels.has(value)) {
      seenModels.add(value)
      models.push(value)
    }
  }

  return { models, buckets }
}

export function mergeVertexStorageModels(
  models: string[],
  buckets: string[]
): string[] {
  const regularModels = splitVertexStorageModels(models).models
  const normalizedBuckets: string[] = []
  const seenBuckets = new Set<string>()

  for (const rawBucket of buckets) {
    const bucket = normalizeVertexStorageBucket(rawBucket)
    if (!bucket || seenBuckets.has(bucket)) continue
    seenBuckets.add(bucket)
    normalizedBuckets.push(bucket)
  }

  return [
    ...regularModels,
    ...normalizedBuckets.map(
      (bucket) => `${VERTEX_STORAGE_MODEL_PREFIX}${bucket}`
    ),
  ]
}
