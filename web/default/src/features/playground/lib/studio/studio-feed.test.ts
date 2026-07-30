/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { describe, expect, it } from 'vitest'

import { createLocalRunId, groupRunsIntoBatches } from './studio-feed'

describe('groupRunsIntoBatches', () => {
  it('groups same-prompt runs created together into one batch', () => {
    const t = 1_700_000_000_000
    const batches = groupRunsIntoBatches([
      { id: 1, prompt: 'a cat', createdAt: t },
      { id: 2, prompt: 'a cat', createdAt: t + 1000 },
      { id: 3, prompt: 'a dog', createdAt: t + 2000 },
    ])
    expect(batches).toHaveLength(2)
    expect(batches[0].runs.map((run) => run.id)).toEqual([1, 2])
    expect(batches[1].runs.map((run) => run.id)).toEqual([3])
  })

  it('splits same-prompt runs that are far apart in time', () => {
    const t = 1_700_000_000_000
    const batches = groupRunsIntoBatches([
      { id: 1, prompt: 'a cat', createdAt: t },
      { id: 2, prompt: 'a cat', createdAt: t + 600_000 },
    ])
    expect(batches).toHaveLength(2)
  })

  it('keeps legacy runs without timestamps grouped by prompt only', () => {
    const batches = groupRunsIntoBatches([
      { id: 1, prompt: 'a cat' },
      { id: 2, prompt: 'a cat' },
      { id: 3, prompt: 'a dog' },
    ])
    expect(batches).toHaveLength(2)
    expect(batches[0].runs).toHaveLength(2)
  })

  it('returns empty for missing input', () => {
    expect(groupRunsIntoBatches(undefined)).toEqual([])
    expect(groupRunsIntoBatches([])).toEqual([])
  })
})

describe('createLocalRunId', () => {
  it('returns unique negative ids', () => {
    const a = createLocalRunId()
    const b = createLocalRunId()
    expect(a).toBeLessThan(0)
    expect(b).toBeLessThan(0)
    expect(a).not.toBe(b)
  })
})
