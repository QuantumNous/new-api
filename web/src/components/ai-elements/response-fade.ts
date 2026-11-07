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

/** Must match the animation duration on `[data-stream-fade]` in styles/index.css */
export const FADE_DURATION_MS = 250
export const FADE_STAGGER_MS = 25
export const FADE_STAGGER_MAX_MS = 250
/**
 * Text already longer than this when animation starts is hydrated/resumed
 * content (reconnected stream, conversation switch), not a fresh delta —
 * that content becomes the baseline instead of re-fading.
 */
export const FADE_HYDRATION_THRESHOLD = 120

type FadeEntry = { at: number; delay: number }

type PendingRun = {
  prevCount: number
  additions: Map<number, FadeEntry>
  now: number
}

export type FadeState = {
  /** Total characters classified during the last committed run */
  prevCount: number
  /** Parts still mid-animation, keyed by start offset */
  active: Map<number, FadeEntry>
  /** True until the first run commits */
  firstRun: boolean
  /** Staged result of the latest render; published on commit */
  pending: PendingRun | null
}

export type FadeRun = {
  state: FadeState
  now: number
  count: number
  newIndex: number
  /** Baseline mode: classify everything as already seen */
  suppress: boolean
  additions: Map<number, FadeEntry>
}

export type FadeSegment = {
  start: number
  value: string
  animated: boolean
  delay: number
}

const WORD_REGEX = /\S+\s*/g
const NON_WHITESPACE_REGEX = /\S/
const WHITESPACE_REGEX = /\s/
/**
 * Scripts without word-delimiting spaces: Thai, Lao, Myanmar, Khmer,
 * Tibetan, CJK ideographs/kana, Hangul, and CJK compatibility ideographs.
 */
const SPACELESS_REGEX =
  /[\u0E00-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1780-\u17FF\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/
/**
 * CJK punctuation followed by kana or a Han ideograph: no word-break rule
 * joins the pair, and the segmenter's dictionary run restarts after the
 * punctuation, so the word segments that follow do not depend on earlier text.
 */
const CJK_BREAK_BEFORE_REGEX = /[\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F]/
const CJK_BREAK_AFTER_REGEX =
  /[\u3041-\u3096\u30A1-\u30FA\u3400-\u4DBF\u4E00-\u9FFF]/
const MAX_SPLIT_POINT_SCAN = 256

let wordSegmenter: Intl.Segmenter | null | undefined

function getWordSegmenter(): Intl.Segmenter | null {
  if (wordSegmenter === undefined) {
    wordSegmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'word' })
        : null
  }
  return wordSegmenter
}

function pushSegmentedParts(parts: string[], token: string): void {
  const segmenter = getWordSegmenter()
  if (segmenter == null) {
    parts.push(token)
    return
  }
  const trailing = /\s+$/.exec(token)
  const word = trailing == null ? token : token.slice(0, trailing.index)
  for (const segment of segmenter.segment(word)) {
    parts.push(segment.segment)
  }
  if (trailing != null) {
    parts.push(trailing[0])
  }
}

/**
 * Splits text into word parts (non-whitespace run plus trailing whitespace).
 * Spaceless scripts are further split via Intl.Segmenter.
 * Concatenating the result always reproduces the input exactly.
 */
export function splitWords(value: string): string[] {
  const parts: string[] = []
  WORD_REGEX.lastIndex = 0
  let index = 0
  let match: RegExpExecArray | null
  while ((match = WORD_REGEX.exec(value)) !== null) {
    if (match.index > index) {
      parts.push(value.slice(index, match.index))
    }
    const token = match[0]
    if (SPACELESS_REGEX.test(token)) {
      pushSegmentedParts(parts, token)
    } else {
      parts.push(token)
    }
    index = match.index + token.length
  }
  if (index < value.length) {
    parts.push(value.slice(index))
  }
  return parts
}

/**
 * Whether splitWords(value.slice(index)) yields exactly the parts that
 * splitWords(value) produces from index on: index starts a whitespace-
 * delimited token, or follows CJK punctuation inside a spaceless run.
 */
function isStableSplitPoint(value: string, index: number): boolean {
  const before = value[index - 1] ?? ''
  const after = value[index] ?? ''
  if (WHITESPACE_REGEX.test(before)) {
    return NON_WHITESPACE_REGEX.test(after)
  }
  return (
    CJK_BREAK_BEFORE_REGEX.test(before) &&
    CJK_BREAK_AFTER_REGEX.test(after) &&
    getWordSegmenter() != null
  )
}

export function createFadeState(): FadeState {
  return { prevCount: 0, active: new Map(), firstRun: true, pending: null }
}

export function beginRun(state: FadeState, suppress = false): FadeRun {
  return {
    state,
    now: performance.now(),
    count: 0,
    newIndex: 0,
    suppress,
    additions: new Map(),
  }
}

/**
 * Stages the run's result without publishing. Classification never mutates
 * committed state during render, so abandoned renders leave no trace.
 */
export function stageRun(run: FadeRun): void {
  run.state.pending = {
    prevCount: run.count,
    additions: run.additions,
    now: run.now,
  }
}

/** Publishes the staged run: baseline offset, new animations, pruned entries. */
export function commitRun(state: FadeState): void {
  const pending = state.pending
  if (pending == null) {
    return
  }
  state.pending = null
  state.firstRun = false
  state.prevCount = pending.prevCount
  for (const [start, entry] of pending.additions) {
    state.active.set(start, entry)
  }
  for (const [start, entry] of state.active) {
    if (!isFading(entry, pending.now)) {
      state.active.delete(start)
    }
  }
}

function isFading(entry: FadeEntry, now: number): boolean {
  return now - entry.at < entry.delay + FADE_DURATION_MS
}

/** Stages and immediately commits — for callers without a commit phase. */
export function endRun(run: FadeRun): void {
  stageRun(run)
  commitRun(run.state)
}

/**
 * Classifies one text value into fade segments, advancing document-order
 * character offset. New parts (start >= prevCount) animate; parts still
 * inside their animation window replay identical props.
 *
 * Only text that can animate is split into words: the settled head of the
 * value (before prevCount, with no part still fading) becomes one plain
 * segment, so each render splits the streamed tail rather than the whole
 * response.
 */
export function classifyValue(run: FadeRun, value: string): FadeSegment[] {
  const { state, now } = run
  const valueStart = run.count
  const valueEnd = valueStart + value.length
  let liveStart = run.suppress
    ? valueEnd
    : Math.min(Math.max(valueStart, state.prevCount), valueEnd)
  if (!run.suppress) {
    for (const [start, entry] of state.active) {
      if (start >= valueStart && start < liveStart && isFading(entry, now)) {
        liveStart = start
      }
    }
  }
  // Back up to a point where splitting the tail yields the same parts (and
  // therefore the same start keys) as splitting the whole value. A long run
  // without such a point is split whole rather than scanned to its start.
  let splitFrom = liveStart - valueStart
  const scanLimit = splitFrom - MAX_SPLIT_POINT_SCAN
  while (
    splitFrom > 0 &&
    splitFrom < value.length &&
    !isStableSplitPoint(value, splitFrom)
  ) {
    splitFrom = splitFrom > scanLimit ? splitFrom - 1 : 0
  }

  const segments: FadeSegment[] = []
  if (splitFrom > 0) {
    segments.push({
      start: valueStart,
      value: value.slice(0, splitFrom),
      animated: false,
      delay: 0,
    })
    run.count += splitFrom
  }
  if (splitFrom === value.length) {
    return segments
  }

  for (const part of splitWords(value.slice(splitFrom))) {
    const start = run.count
    run.count += part.length
    if (!NON_WHITESPACE_REGEX.test(part)) {
      segments.push({ start, value: part, animated: false, delay: 0 })
      continue
    }
    if (start >= state.prevCount) {
      const staged = run.additions.get(start)
      const delay =
        staged?.delay ??
        Math.min(run.newIndex * FADE_STAGGER_MS, FADE_STAGGER_MAX_MS)
      run.newIndex += 1
      run.additions.set(start, staged ?? { at: now, delay })
      segments.push({ start, value: part, animated: true, delay })
      continue
    }
    const entry = state.active.get(start)
    if (entry != null && isFading(entry, now)) {
      segments.push({
        start,
        value: part,
        animated: true,
        delay: entry.delay,
      })
      continue
    }
    segments.push({ start, value: part, animated: false, delay: 0 })
  }
  return segments
}
