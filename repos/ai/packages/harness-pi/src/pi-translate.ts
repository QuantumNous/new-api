import { randomBytes } from 'node:crypto';
import type { HarnessV1StreamPart } from '@ai-sdk/harness';
import { extractAssistantText, type PiSessionEvent } from './pi-events';
import { serializeToolOutput } from './pi-utils';

/**
 * Translator state shared across all events of a single turn. Reset at the
 * start of every `doPromptTurn`. Callers update the same instance and read it to
 * decide when a turn has settled into a steady state (e.g. for gap-filling).
 */
export interface PiTranslatorState {
  /**
   * True once a `turn_start` or assistant `message_start` event has been
   * observed. Suppresses spurious deltas that arrive before the turn opens.
   */
  promptStarted: boolean;
  /** Accumulated assistant text from `text_delta` events. */
  streamedAssistantText: string;
  /** Stream-part id for the active text block; synthesized on first delta. */
  currentTextId: string | undefined;
  /**
   * Stream-part id for the active reasoning block; synthesized lazily on
   * first `thinking_delta`.
   */
  currentReasoningId: string | undefined;
  /** Whether a `reasoning-start` event has already been emitted. */
  reasoningStarted: boolean;
  /** Tool-call id → tool name (used to fill in `toolName` on results). */
  observedToolNames: Map<string, string>;
  /**
   * Tool-call id → the exact output value the host submitted for a
   * user-registered (host-executed) tool. Pi only echoes the tool result back
   * as serialized text (the tool handler stringifies the output before handing
   * it to the runtime so the model can read it), which would otherwise reach
   * consumers as a string and lose the original object structure. Keeping the
   * submitted value here lets the result projection surface the original object
   * — matching the other adapters — while the model still receives the text.
   * Populated by the session's `submitToolResult`; consumed (and cleared) when
   * the matching `tool_result`/`tool_execution_end` event is translated.
   */
  hostToolResults: Map<string, unknown>;
  /**
   * Names of tools that Pi executes natively (read/write/edit/bash/grep/
   * find/ls). `tool-call` events for these get `providerExecuted: true`
   * so the harness host doesn't try to dispatch them. User-registered
   * tools are not in this set.
   */
  readonly builtinToolNames: ReadonlySet<string>;
  /**
   * Map of native tool name → common name. `find` → `glob`, etc. Pi emits
   * native names on its events; the wire `toolName` is the common name when
   * one exists.
   */
  readonly nativeToCommonNameMap: ReadonlyMap<string, string>;
}

export interface PiTranslatorStateOptions {
  readonly builtinToolNames?: ReadonlyArray<string>;
  readonly nativeToCommon?:
    | ReadonlyMap<string, string>
    | Record<string, string>;
}

export function createPiTranslatorState(
  options: PiTranslatorStateOptions = {},
): PiTranslatorState {
  const map =
    options.nativeToCommon instanceof Map
      ? options.nativeToCommon
      : new Map(Object.entries(options.nativeToCommon ?? {}));
  return {
    promptStarted: false,
    streamedAssistantText: '',
    currentTextId: undefined,
    currentReasoningId: undefined,
    reasoningStarted: false,
    observedToolNames: new Map(),
    hostToolResults: new Map(),
    builtinToolNames: new Set(options.builtinToolNames ?? []),
    nativeToCommonNameMap: map,
  };
}

function newId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Pi's `tool_execution_end` event payload (`result`) is a Pi `AgentToolResult`
 * envelope `{ content: (TextContent | ImageContent)[], details, terminate? }`.
 * The `tool_result` event uses a flat shape with `content` and `details` at
 * the top level. In both cases we extract just the text payload (joined when
 * multiple text parts are present) so the AI SDK consumer sees the raw
 * string the tool produced.
 */
function unwrapPiToolResult(event: PiSessionEvent): never {
  const candidates: unknown[] = [];
  const result = event.result as unknown;
  if (result && typeof result === 'object') {
    const inner = (result as { content?: unknown }).content;
    if (Array.isArray(inner)) candidates.push(inner);
  }
  if (Array.isArray(event.content)) candidates.push(event.content);

  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const text = content
      .filter(
        (p): p is { type: 'text'; text: string } =>
          !!p &&
          typeof p === 'object' &&
          (p as { type?: unknown }).type === 'text' &&
          typeof (p as { text?: unknown }).text === 'string',
      )
      .map(p => p.text)
      .join('');
    if (text) return text as never;
  }

  if (typeof event.result === 'string') return event.result as never;
  if (typeof event.content === 'string') return event.content as never;
  return (event.result ?? event.content ?? null) as never;
}

function resolveToolName(
  state: PiTranslatorState,
  nativeName: string,
): { wire: string; native: string } {
  const common = state.nativeToCommonNameMap.get(nativeName);
  return { wire: common ?? nativeName, native: nativeName };
}

/**
 * Translate a single Pi `session.subscribe` event into zero or more
 * `HarnessV1StreamPart`s, updating the translator state in place. Returns
 * an empty array for events that produce no output (e.g. events emitted
 * before `turn_start`).
 *
 * The translator does NOT emit `stream-start`/`finish` — those are
 * lifecycle signals owned by the session layer.
 */
export function translatePiEvent(
  event: PiSessionEvent,
  state: PiTranslatorState,
): HarnessV1StreamPart[] {
  switch (event.type) {
    case 'turn_start':
    case 'message_start': {
      if (
        event.type === 'message_start' &&
        event.message?.role !== 'assistant'
      ) {
        return [];
      }
      state.promptStarted = true;
      state.streamedAssistantText = '';
      state.currentTextId = undefined;
      state.currentReasoningId = undefined;
      state.reasoningStarted = false;
      return [];
    }

    case 'message_update': {
      if (!state.promptStarted) return [];
      const update = event.assistantMessageEvent;
      if (!update) return [];
      if (update.type === 'text_delta' && typeof update.delta === 'string') {
        const parts: HarnessV1StreamPart[] = [];
        // If reasoning was active, close it before opening the text block so
        // consumers can reset block-scoped formatting (ANSI colors, etc.)
        // between sections.
        if (state.reasoningStarted && state.currentReasoningId) {
          parts.push({
            type: 'reasoning-end',
            id: state.currentReasoningId,
          });
          state.reasoningStarted = false;
          state.currentReasoningId = undefined;
        }
        if (!state.currentTextId) {
          state.currentTextId = newId();
          parts.push({ type: 'text-start', id: state.currentTextId });
        }
        state.streamedAssistantText += update.delta;
        parts.push({
          type: 'text-delta',
          id: state.currentTextId,
          delta: update.delta,
        });
        return parts;
      }
      if (
        update.type === 'thinking_delta' &&
        typeof update.delta === 'string'
      ) {
        const parts: HarnessV1StreamPart[] = [];
        // Symmetric to the text branch: close any open text block before
        // starting a fresh reasoning block.
        if (state.currentTextId) {
          parts.push({ type: 'text-end', id: state.currentTextId });
          state.currentTextId = undefined;
        }
        if (!state.currentReasoningId) {
          state.currentReasoningId = newId();
        }
        if (!state.reasoningStarted) {
          state.reasoningStarted = true;
          parts.push({ type: 'reasoning-start', id: state.currentReasoningId });
        }
        parts.push({
          type: 'reasoning-delta',
          id: state.currentReasoningId,
          delta: update.delta,
        });
        return parts;
      }
      return [];
    }

    case 'message_end':
    case 'turn_end': {
      if (!state.promptStarted) return [];
      const parts: HarnessV1StreamPart[] = [];
      const fullText = extractAssistantText(event.message);
      if (
        state.currentTextId &&
        fullText.startsWith(state.streamedAssistantText) &&
        fullText.length > state.streamedAssistantText.length
      ) {
        const missing = fullText.slice(state.streamedAssistantText.length);
        state.streamedAssistantText = fullText;
        parts.push({
          type: 'text-delta',
          id: state.currentTextId,
          delta: missing,
        });
      }
      if (state.currentTextId) {
        parts.push({ type: 'text-end', id: state.currentTextId });
        state.currentTextId = undefined;
      }
      if (state.reasoningStarted && state.currentReasoningId) {
        parts.push({ type: 'reasoning-end', id: state.currentReasoningId });
        state.reasoningStarted = false;
        state.currentReasoningId = undefined;
      }
      return parts;
    }

    case 'tool_execution_start': {
      if (!event.toolCallId || !event.toolName) return [];
      const { wire, native } = resolveToolName(state, event.toolName);
      state.observedToolNames.set(event.toolCallId, wire);
      const providerExecuted = state.builtinToolNames.has(native);
      const input = serializeToolOutput(event.args ?? event.input ?? {});
      return [
        {
          type: 'tool-call',
          toolCallId: event.toolCallId,
          toolName: wire,
          input,
          ...(wire !== native ? { nativeName: native } : {}),
          ...(providerExecuted ? { providerExecuted: true } : {}),
        } as HarnessV1StreamPart,
      ];
    }

    case 'tool_execution_end':
    case 'tool_result': {
      if (!event.toolCallId) return [];
      const recordedName = state.observedToolNames.get(event.toolCallId);
      const nativeName = event.toolName;
      const wire =
        recordedName ??
        (nativeName ? resolveToolName(state, nativeName).wire : undefined);
      if (!wire) return [];
      /*
       * Prefer the exact value the host submitted for user-registered tools
       * (see `hostToolResults`). Built-in tools, whose results Pi produces and
       * reports as text, are not in the map and fall back to unwrapping the
       * event's text payload.
       */
      const result = state.hostToolResults.has(event.toolCallId)
        ? ((state.hostToolResults.get(event.toolCallId) ?? null) as Extract<
            HarnessV1StreamPart,
            { type: 'tool-result' }
          >['result'])
        : unwrapPiToolResult(event);
      state.hostToolResults.delete(event.toolCallId);
      return [
        {
          type: 'tool-result',
          toolCallId: event.toolCallId,
          toolName: wire,
          result,
          ...(event.isError ? { isError: true } : {}),
        } as HarnessV1StreamPart,
      ];
    }

    case 'compaction_end': {
      /*
       * Pi performs the compaction itself; we observe its result. Skip aborted
       * or result-less compactions (nothing happened). A result with no summary
       * still represents a real compaction, so emit it with a placeholder
       * rather than dropping the event. `reason` is `'manual'` for an explicit
       * `session.compact()` call, `'threshold'`/`'overflow'` for Pi's automatic
       * compaction — both map to `'auto'` on the wire. Pi reports `tokensBefore`
       * but not `tokensAfter`.
       */
      if (event.aborted) return [];
      const result = event.result;
      if (!result || typeof result !== 'object') return [];
      const rawSummary = (result as { summary?: unknown }).summary;
      const summary =
        typeof rawSummary === 'string' ? rawSummary : '(no summary provided)';
      const tokensBefore = (result as { tokensBefore?: unknown }).tokensBefore;
      return [
        {
          type: 'compaction',
          trigger: event.reason === 'manual' ? 'manual' : 'auto',
          summary,
          ...(typeof tokensBefore === 'number' ? { tokensBefore } : {}),
        },
      ];
    }

    default:
      return [];
  }
}
