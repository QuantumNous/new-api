/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
const CHUNK_LOAD_ERROR_PATTERN =
  /chunkloaderror|loading (?:css )?chunk .+ failed|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to load module script/i

export function isChunkLoadError(error: unknown): boolean {
  if (typeof error === 'string') return CHUNK_LOAD_ERROR_PATTERN.test(error)
  if (typeof error !== 'object' || error === null) return false

  const value = error as Record<string, unknown>
  const name = typeof value.name === 'string' ? value.name : ''
  const message = typeof value.message === 'string' ? value.message : ''
  return CHUNK_LOAD_ERROR_PATTERN.test(`${name}: ${message}`)
}
