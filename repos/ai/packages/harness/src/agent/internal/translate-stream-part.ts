import type { HarnessV1StreamPart } from '../../v1';
import type { TextStreamPart } from 'ai';
import { generateId, type ToolSet } from '@ai-sdk/provider-utils';

/**
 * Translate one event from the harness wire format to the AI SDK
 * `TextStreamPart` shape consumed by `streamText` callers.
 *
 * Most variants are close to the identity function — V4 primitives
 * (`LanguageModelV4ToolCall`, `LanguageModelV4ToolResult`,
 * `LanguageModelV4ToolApprovalRequest`, `LanguageModelV4FinishReason`,
 * `LanguageModelV4Usage`) flow through unchanged. The adapters are:
 *   - `harnessMetadata` → `providerMetadata`
 *   - tool-call events are not translated here — validation against the
 *     merged tool set is async and handled by `validateToolCall` in
 *     `run-prompt.ts`
 *   - the harness `raw` part is forwarded as the AI SDK `raw` part
 *
 * Returns an array of zero or more AI SDK parts. Most harness events project
 * to a single AI SDK part; `file-change` fans out into a synthetic
 * dynamic + provider-executed `tool-call` / `tool-result` pair so the event
 * is observable in `streamText`-style flows without a new stream-part type
 * needing first-class AI SDK support. Events with no consumer-facing AI SDK
 * equivalent (`stream-start`, `finish-step`, `finish` — consumed internally)
 * return an empty array.
 */
export function translateStreamPart<TOOLS extends ToolSet>(
  event: HarnessV1StreamPart,
): ReadonlyArray<TextStreamPart<TOOLS>> {
  switch (event.type) {
    case 'stream-start':
      // The agent emits its own `start` part with normalized warnings;
      // the harness-level start signal is consumed internally.
      return [];

    case 'text-start':
      return [
        {
          type: 'text-start',
          id: event.id,
          providerMetadata: event.harnessMetadata,
        } as TextStreamPart<TOOLS>,
      ];

    case 'text-delta':
      return [
        {
          type: 'text-delta',
          id: event.id,
          text: event.delta,
          providerMetadata: event.harnessMetadata,
        } as TextStreamPart<TOOLS>,
      ];

    case 'text-end':
      return [
        {
          type: 'text-end',
          id: event.id,
          providerMetadata: event.harnessMetadata,
        } as TextStreamPart<TOOLS>,
      ];

    case 'reasoning-start':
      return [
        {
          type: 'reasoning-start',
          id: event.id,
          providerMetadata: event.harnessMetadata,
        } as TextStreamPart<TOOLS>,
      ];

    case 'reasoning-delta':
      return [
        {
          type: 'reasoning-delta',
          id: event.id,
          text: event.delta,
          providerMetadata: event.harnessMetadata,
        } as TextStreamPart<TOOLS>,
      ];

    case 'reasoning-end':
      return [
        {
          type: 'reasoning-end',
          id: event.id,
          providerMetadata: event.harnessMetadata,
        } as TextStreamPart<TOOLS>,
      ];

    case 'tool-call':
      // Tool-call validation is async (it parses input against the tool's
      // schema) and lives in `run-prompt.ts` where the merged tool set is in
      // scope. The translator returns nothing here — the run-prompt loop
      // handles the emission.
      return [];

    case 'tool-approval-request':
      return [];

    case 'tool-result':
      return [
        {
          type: 'tool-result',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: undefined,
          output: event.result,
          ...(event.preliminary !== undefined
            ? { preliminary: event.preliminary }
            : {}),
          ...(event.providerMetadata !== undefined
            ? { providerMetadata: event.providerMetadata }
            : {}),
        } as TextStreamPart<TOOLS>,
      ];

    case 'file-change': {
      /*
       * `file-change` has no first-class AI SDK stream-part equivalent.
       * Project it as a synthetic dynamic + provider-executed tool-call /
       * tool-result pair under the reserved name `fileChange` so the event
       * is visible to `streamText`-style consumers. `dynamic: true` keeps it
       * out of typed-tool lookups; `providerExecuted: true` signals the
       * runtime already executed it and the host should not dispatch.
       */
      const toolCallId = `harness-file-change-${generateId()}`;
      const payload = { event: event.event, path: event.path };
      return [
        {
          type: 'tool-call',
          toolCallId,
          toolName: 'fileChange',
          input: payload,
          dynamic: true,
          providerExecuted: true,
          ...(event.harnessMetadata !== undefined
            ? { providerMetadata: event.harnessMetadata }
            : {}),
        } as TextStreamPart<TOOLS>,
        {
          type: 'tool-result',
          toolCallId,
          toolName: 'fileChange',
          input: payload,
          output: payload,
          dynamic: true,
          providerExecuted: true,
          ...(event.harnessMetadata !== undefined
            ? { providerMetadata: event.harnessMetadata }
            : {}),
        } as TextStreamPart<TOOLS>,
      ];
    }

    case 'compaction': {
      /*
       * Like `file-change`, compaction has no first-class AI SDK stream-part
       * equivalent. Project it as a synthetic dynamic + provider-executed
       * tool-call / tool-result pair under the reserved name `compaction`, so
       * the event is visible to `streamText`-style consumers. Compaction takes
       * no input, so the call input is empty; the metadata rides on the result
       * output. `dynamic: true` keeps it out of typed-tool lookups;
       * `providerExecuted: true` signals the runtime already performed it.
       */
      const toolCallId = `harness-compaction-${generateId()}`;
      const output = {
        trigger: event.trigger,
        summary: event.summary,
        ...(event.tokensBefore !== undefined
          ? { tokensBefore: event.tokensBefore }
          : {}),
        ...(event.tokensAfter !== undefined
          ? { tokensAfter: event.tokensAfter }
          : {}),
      };
      return [
        {
          type: 'tool-call',
          toolCallId,
          toolName: 'compaction',
          input: {},
          dynamic: true,
          providerExecuted: true,
          ...(event.harnessMetadata !== undefined
            ? { providerMetadata: event.harnessMetadata }
            : {}),
        } as TextStreamPart<TOOLS>,
        {
          type: 'tool-result',
          toolCallId,
          toolName: 'compaction',
          input: {},
          output,
          dynamic: true,
          providerExecuted: true,
          ...(event.harnessMetadata !== undefined
            ? { providerMetadata: event.harnessMetadata }
            : {}),
        } as TextStreamPart<TOOLS>,
      ];
    }

    case 'error':
      return [{ type: 'error', error: event.error } as TextStreamPart<TOOLS>];

    case 'raw':
      return [
        { type: 'raw', rawValue: event.rawValue } as TextStreamPart<TOOLS>,
      ];

    case 'finish-step':
    case 'finish':
      // finish-step / finish are consumed by the agent's result builder, not
      // forwarded directly. The agent emits AI SDK `finish-step` / `finish`
      // parts itself once it has assembled the surrounding step / response
      // metadata.
      return [];
  }
}
