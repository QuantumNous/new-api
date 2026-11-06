import type { UIMessageChunk } from 'ai';

/**
 * Tracks, for one part family (text or reasoning), which part ids are open or
 * ended within the current step.
 */
interface PartFrameState {
  /** A `*-start` was seen and not yet ended in the current step. */
  open: Set<string>;
  /** A part that was opened and ended in the current step. */
  ended: Set<string>;
}

const newPartFrameState = (): PartFrameState => ({
  open: new Set(),
  ended: new Set(),
});

/**
 * Repairs the framing for a single `*-start` / `*-delta` / `*-end` chunk
 * against the running per-step state, yielding the chunks the consumer should
 * see. Text and reasoning parts share this logic (`startType` differentiates
 * the synthesized start chunk).
 *
 * @yields the chunks (possibly synthesized, possibly none) the consumer should see.
 */
function* repairPart(
  kind: 'start' | 'delta' | 'end',
  id: string,
  chunk: UIMessageChunk,
  state: PartFrameState,
  startType: 'text-start' | 'reasoning-start',
): Generator<UIMessageChunk> {
  if (kind === 'start') {
    // Drop a duplicate/replayed start for a part already framed this step.
    if (state.open.has(id) || state.ended.has(id)) {
      return;
    }
    state.open.add(id);
    yield chunk;
    return;
  }

  // delta / end: drop a re-delivered chunk for an already-ended part.
  if (state.ended.has(id)) {
    return;
  }
  // Synthesize the missing start for an orphaned delta/end.
  if (!state.open.has(id)) {
    state.open.add(id);
    yield { type: startType, id } as UIMessageChunk;
  }
  if (kind === 'end') {
    state.open.delete(id);
    state.ended.add(id);
  }
  yield chunk;
}

/**
 * Normalizes the part framing of a UI message stream so it is always
 * well-formed for the AI SDK's stream consumer (`processUIMessageStream`,
 * which backs `useChat`/`readUIMessageStream`).
 *
 * ## Why this exists
 *
 * The consumer maintains a map of "active" text/reasoning parts keyed by id.
 * A `text-delta`/`text-end` for an id that has no open part is a fatal error
 * (`Received text-delta for missing text part with ID "0" ...`) that kills the
 * whole turn. Two properties of the durable streaming model make that error
 * reachable:
 *
 * - A workflow run owns a single shared stream, and the consumer resets its
 *   active-part maps on every `finish-step`. Multi-step turns reuse the same
 *   part id (commonly `"0"`) in each step, so a single dropped or duplicated
 *   `*-start` across a step boundary orphans the rest of that step's content.
 * - The same stream is read across reconnects, and a stream-producing step can
 *   run more than once (retry/redelivery, or the concurrent-worker duplication
 *   tracked in vercel/workflow#2331 and #2039). Either can interleave or
 *   duplicate chunks on the shared stream — e.g. a `finish-step` landing in the
 *   middle of another execution's text part.
 *
 * Since the content is still flowing and only the framing is damaged, repairing
 * the framing here degrades the worst case to "text begins slightly into the
 * step" or "a duplicated tail is dropped" instead of a dead turn.
 *
 * ## What it does
 *
 * Mirrors the consumer's part-lifetime state machine, per part type, per step:
 * - resets tracking on `finish-step` (exactly where the consumer resets);
 * - synthesizes a missing `*-start` when an orphaned `*-delta`/`*-end` arrives;
 * - drops a re-delivered `*-start`/`*-delta`/`*-end` for a part already
 *   open or ended in the current step (reconnect/replay overlap).
 *
 * A well-formed stream passes through unchanged.
 *
 * ## Scope: text and reasoning only
 *
 * `tool-input-delta` raises the same class of fatal error (`Received
 * tool-input-delta for missing tool call ...`), but tool parts are deliberately
 * left untouched: the consumer does not reset its tool-call map on `finish-step`
 * and tool-call ids are unique, so the step-boundary id-reuse orphaning that
 * makes text/reasoning fragile does not apply to them. If a future duplication
 * mode is found to orphan tool-input parts, extend the same machine to that
 * family rather than special-casing it.
 *
 * @param source the raw UI message chunk stream to normalize.
 * @yields the framing-corrected UI message chunks.
 */
export async function* normalizeUIMessageStreamParts(
  source: AsyncIterable<UIMessageChunk>,
): AsyncGenerator<UIMessageChunk> {
  const text = newPartFrameState();
  const reasoning = newPartFrameState();

  for await (const chunk of source) {
    switch (chunk.type) {
      case 'finish-step':
        // The consumer clears its active-part maps here, so part ids may be
        // legitimately reused in the next step. Reset to match.
        text.open.clear();
        text.ended.clear();
        reasoning.open.clear();
        reasoning.ended.clear();
        yield chunk;
        break;

      case 'text-start':
        yield* repairPart('start', chunk.id, chunk, text, 'text-start');
        break;
      case 'text-delta':
        yield* repairPart('delta', chunk.id, chunk, text, 'text-start');
        break;
      case 'text-end':
        yield* repairPart('end', chunk.id, chunk, text, 'text-start');
        break;

      case 'reasoning-start':
        yield* repairPart(
          'start',
          chunk.id,
          chunk,
          reasoning,
          'reasoning-start',
        );
        break;
      case 'reasoning-delta':
        yield* repairPart(
          'delta',
          chunk.id,
          chunk,
          reasoning,
          'reasoning-start',
        );
        break;
      case 'reasoning-end':
        yield* repairPart('end', chunk.id, chunk, reasoning, 'reasoning-start');
        break;

      default:
        yield chunk;
    }
  }
}
