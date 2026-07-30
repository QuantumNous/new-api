/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import type { StudioRunSummary } from '../session/session-types'
import type { StudioSettings } from '../../types'

/**
 * A display batch on the studio feed: one generation request and its
 * results. Persisted runs store one row per output (image n>1 creates n
 * runs with the same prompt), so the feed re-groups them for display.
 */
export type StudioFeedBatch = {
  key: string
  prompt: string
  model?: string
  createdAt?: number
  runs: StudioRunSummary[]
}

/** Runs created within this window with the same prompt render as one batch. */
const BATCH_WINDOW_MS = 90_000

export function groupRunsIntoBatches(
  runs: StudioRunSummary[] | undefined
): StudioFeedBatch[] {
  if (!runs || runs.length === 0) return []
  const batches: StudioFeedBatch[] = []
  for (const run of runs) {
    const prompt = run.prompt?.trim() ?? ''
    const previous = batches.at(-1)
    const sameBatch =
      previous != null &&
      previous.prompt === prompt &&
      isWithinBatchWindow(previous.createdAt, run.createdAt)
    if (sameBatch && previous) {
      previous.runs.push(run)
      continue
    }
    batches.push({
      key: `b${batches.length}-${run.id}`,
      prompt,
      model: run.model,
      createdAt: run.createdAt,
      runs: [run],
    })
  }
  return batches
}

function isWithinBatchWindow(a?: number, b?: number): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(b - a) <= BATCH_WINDOW_MS
}

/**
 * Unique local id for runs that could not be linked to a cloud run (offline,
 * API failure). Negative so it can never collide with server ids.
 */
let localRunCounter = 0
export function createLocalRunId(): number {
  localRunCounter += 1
  return -(Date.now() * 1000 + (localRunCounter % 1000))
}

export type StudioGenerationInput = {
  modality: 'image' | 'video' | 'audio'
  /** Session the results belong to, captured at submit time. */
  sessionId: string
  prompt: string
  model: string
  group: string
  /** Data URLs: image references (up to 4) or video first frame (1). */
  references: string[]
}

/** In-flight or failed generation shown on the feed before its runs exist. */
export type PendingStudioRun = {
  clientId: string
  input: StudioGenerationInput
  /** Settings snapshot taken when the run was submitted. */
  settings: StudioSettings
  startedAt: number
  status: 'running' | 'error'
  error?: string
}
