/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { isChunkLoadError } from './chunk-load-error'

describe('isChunkLoadError', () => {
  it.each([
    new Error('Loading chunk 6910 failed.'),
    Object.assign(new Error('Loading chunk 9574 failed.'), {
      name: 'ChunkLoadError',
    }),
    new TypeError('Failed to fetch dynamically imported module'),
    'Importing a module script failed',
    new Error('Failed to load module script: expected JavaScript'),
  ])('recognizes stale route chunk failures', (error) => {
    expect(isChunkLoadError(error)).toBe(true)
  })

  it('does not classify application and HTTP errors as chunk failures', () => {
    expect(isChunkLoadError(new Error('Maximum update depth exceeded'))).toBe(
      false
    )
    expect(isChunkLoadError({ response: { status: 500 } })).toBe(false)
  })
})
