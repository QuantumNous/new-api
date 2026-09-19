import type {
  JSONValue,
  LanguageModelV4FinishReason,
  LanguageModelV4ToolApprovalRequest,
  LanguageModelV4ToolCall,
  LanguageModelV4ToolResult,
  LanguageModelV4Usage,
  SharedV4ProviderMetadata,
} from '@ai-sdk/provider';
import { z } from 'zod/v4';
import type { HarnessV1CallWarning } from './harness-v1-call-warning';
import type { HarnessV1Metadata } from './harness-v1-metadata';

/**
 * One event emitted by a harness adapter during a prompt turn.
 *
 * Mirrors `LanguageModelV4StreamPart` on the variants it shares so a
 * `HarnessAgent` can pipe events through to AI SDK consumers with minimal
 * translation. Primitive types from the V4 spec (`LanguageModelV4ToolCall`,
 * `LanguageModelV4ToolResult`, `LanguageModelV4ToolApprovalRequest`,
 * `LanguageModelV4Usage`, `LanguageModelV4FinishReason`) are reused
 * verbatim — type-compat tests assert this stays the case.
 *
 * The metadata field is named `harnessMetadata` (not `providerMetadata`)
 * because a harness is a peer to a provider, not a kind of provider. The
 * agent rebinds it when forwarding to AI SDK consumers.
 */
export type HarnessV1StreamPart =
  | {
      type: 'stream-start';
      warnings?: ReadonlyArray<HarnessV1CallWarning>;
      /**
       * The model the runtime actually resolved to for this turn, when the
       * adapter learns it at stream start (e.g. Claude Code's `init` message
       * reports the resolved/default model). Surfaced into telemetry as
       * `gen_ai.request.model`. Omitted when the adapter doesn't know it here.
       */
      modelId?: string;
    }

  // Text blocks
  | { type: 'text-start'; id: string; harnessMetadata?: HarnessV1Metadata }
  | {
      type: 'text-delta';
      id: string;
      delta: string;
      harnessMetadata?: HarnessV1Metadata;
    }
  | { type: 'text-end'; id: string; harnessMetadata?: HarnessV1Metadata }

  // Reasoning blocks
  | { type: 'reasoning-start'; id: string; harnessMetadata?: HarnessV1Metadata }
  | {
      type: 'reasoning-delta';
      id: string;
      delta: string;
      harnessMetadata?: HarnessV1Metadata;
    }
  | { type: 'reasoning-end'; id: string; harnessMetadata?: HarnessV1Metadata }

  // Tool calls, approvals, results — reuse V4 primitives.
  //
  // `nativeName` is the only harness-only extension on `tool-call`. It lets
  // adapters surface the runtime's native name for a builtin when it differs
  // from the wire `toolName` (e.g. `toolName: 'bash'`, `nativeName: 'Bash'`).
  //
  // Whether the call was executed by the underlying runtime (Claude Code's
  // built-in `Bash`, Codex's `shell`) vs. needs host dispatch is signalled by
  // the standard `providerExecuted` field on `LanguageModelV4ToolCall` —
  // `true` for runtime-executed builtins, false/undefined for host tools.
  | (LanguageModelV4ToolCall & {
      nativeName?: string;
    })
  | LanguageModelV4ToolApprovalRequest
  | LanguageModelV4ToolResult

  // Step boundary inside a multi-step turn.
  | {
      type: 'finish-step';
      finishReason: LanguageModelV4FinishReason;
      usage: LanguageModelV4Usage;
      harnessMetadata?: HarnessV1Metadata;
    }

  // Turn end.
  | {
      type: 'finish';
      finishReason: LanguageModelV4FinishReason;
      totalUsage: LanguageModelV4Usage;
      harnessMetadata?: HarnessV1Metadata;
    }

  // Workspace file mutation that occurred through an opaque underlying
  // mechanism (one with no visible `tool-call` carrying the same data, e.g.
  // Codex's internal `apply_patch`). Emitted per changed path. Path-only by
  // design — when the mutation goes through a visible tool call, the
  // tool-call/tool-result pair already carries the information.
  | {
      type: 'file-change';
      event: 'create' | 'modify' | 'delete';
      path: string;
      harnessMetadata?: HarnessV1Metadata;
    }

  // Context compaction performed by the underlying runtime (Claude Code's
  // native compaction, Pi's summarization). Observation only — the runtime
  // owns the compaction; the harness neither implements nor schedules it.
  // Emitted once, on completion, since `summary`/`tokensAfter` only exist then.
  | {
      type: 'compaction';
      trigger: 'manual' | 'auto';
      summary: string;
      tokensBefore?: number;
      tokensAfter?: number;
      harnessMetadata?: HarnessV1Metadata;
    }

  // Errors. Multiple may be emitted in a single turn.
  | { type: 'error'; error: unknown }

  // Adapter-specific passthrough. Consumers can opt in to receive these via
  // `HarnessAgent` settings; otherwise they are dropped.
  | { type: 'raw'; rawValue: unknown };

/*
 * Runtime (Zod) encoding of `HarnessV1StreamPart`.
 *
 * `HarnessV1StreamPart` is a compile-time type built on `LanguageModelV4*`
 * types that ship no runtime validator. Bridge adapters receive these parts as
 * JSON across a trust boundary (the sandbox WebSocket), so they need a runtime
 * schema. These schemas ARE that encoding — one source of truth, kept from
 * diverging from the type by the `_assignable` guard below and the mutual
 * `toEqualTypeOf` assertion in `harness-v1-stream-part.test-d.ts`.
 *
 * Members are exported individually so `harness-v1-bridge-protocol.ts` can
 * compose them into the bridge outbound union alongside the transport frames.
 */

const harnessV1JsonValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(harnessV1JsonValueSchema),
    z.record(z.string(), harnessV1JsonValueSchema),
  ]),
);

/*
 * Tool-result values. The inferred type is the spec's `NonNullable<JSONValue>`
 * (matching `LanguageModelV4ToolResult`), but the runtime validator
 * deliberately also accepts `null`: adapters emit `result: <value> ?? null` for
 * tools that produced no output, and that `null` must survive the trust
 * boundary unchanged (it reaches consumers exactly as it did before this schema
 * existed, when a cast hid it). Leniency at runtime, strictness in the type.
 */
const harnessV1ToolResultValueSchema =
  harnessV1JsonValueSchema as unknown as z.ZodType<NonNullable<JSONValue>>;

const harnessV1JsonObjectSchema = z.record(
  z.string(),
  harnessV1JsonValueSchema,
) as unknown as z.ZodType<Record<string, JSONValue>>;

const harnessV1MetadataSchema = z.record(
  z.string(),
  z.record(z.string(), harnessV1JsonValueSchema),
) as unknown as z.ZodType<HarnessV1Metadata>;

const harnessV1ProviderMetadataSchema = z.record(
  z.string(),
  z.record(z.string(), harnessV1JsonValueSchema),
) as unknown as z.ZodType<SharedV4ProviderMetadata>;

const harnessV1CallWarningSchema = z.union([
  z.object({
    type: z.literal('unsupported-setting'),
    setting: z.string(),
    details: z.string().optional(),
  }),
  z.object({
    type: z.literal('unsupported-tool'),
    tool: z.string(),
    details: z.string().optional(),
  }),
  z.object({ type: z.literal('other'), message: z.string() }),
]) as z.ZodType<HarnessV1CallWarning>;

const harnessV1UsageSchema = z.object({
  inputTokens: z.object({
    total: z.number().optional(),
    noCache: z.number().optional(),
    cacheRead: z.number().optional(),
    cacheWrite: z.number().optional(),
  }),
  outputTokens: z.object({
    total: z.number().optional(),
    text: z.number().optional(),
    reasoning: z.number().optional(),
  }),
  raw: harnessV1JsonObjectSchema.optional(),
}) as unknown as z.ZodType<LanguageModelV4Usage>;

const harnessV1FinishReasonSchema = z.object({
  unified: z.enum([
    'stop',
    'length',
    'content-filter',
    'tool-calls',
    'error',
    'other',
  ]),
  raw: z.string().optional(),
}) as unknown as z.ZodType<LanguageModelV4FinishReason>;

export const harnessV1StreamStartPartSchema = z.object({
  type: z.literal('stream-start'),
  warnings: z.array(harnessV1CallWarningSchema).readonly().optional(),
  modelId: z.string().optional(),
});

export const harnessV1TextStartPartSchema = z.object({
  type: z.literal('text-start'),
  id: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1TextDeltaPartSchema = z.object({
  type: z.literal('text-delta'),
  id: z.string(),
  delta: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1TextEndPartSchema = z.object({
  type: z.literal('text-end'),
  id: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1ReasoningStartPartSchema = z.object({
  type: z.literal('reasoning-start'),
  id: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1ReasoningDeltaPartSchema = z.object({
  type: z.literal('reasoning-delta'),
  id: z.string(),
  delta: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1ReasoningEndPartSchema = z.object({
  type: z.literal('reasoning-end'),
  id: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.string(),
  providerExecuted: z.boolean().optional(),
  dynamic: z.boolean().optional(),
  providerMetadata: harnessV1ProviderMetadataSchema.optional(),
  nativeName: z.string().optional(),
});

export const harnessV1ToolApprovalRequestPartSchema = z.object({
  type: z.literal('tool-approval-request'),
  approvalId: z.string(),
  toolCallId: z.string(),
  providerMetadata: harnessV1ProviderMetadataSchema.optional(),
});

export const harnessV1ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  toolName: z.string(),
  result: harnessV1ToolResultValueSchema,
  isError: z.boolean().optional(),
  preliminary: z.boolean().optional(),
  dynamic: z.boolean().optional(),
  providerMetadata: harnessV1ProviderMetadataSchema.optional(),
});

export const harnessV1FinishStepPartSchema = z.object({
  type: z.literal('finish-step'),
  finishReason: harnessV1FinishReasonSchema,
  usage: harnessV1UsageSchema,
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1FinishPartSchema = z.object({
  type: z.literal('finish'),
  finishReason: harnessV1FinishReasonSchema,
  totalUsage: harnessV1UsageSchema,
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1FileChangePartSchema = z.object({
  type: z.literal('file-change'),
  event: z.enum(['create', 'modify', 'delete']),
  path: z.string(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1CompactionPartSchema = z.object({
  type: z.literal('compaction'),
  trigger: z.enum(['manual', 'auto']),
  summary: z.string(),
  tokensBefore: z.number().optional(),
  tokensAfter: z.number().optional(),
  harnessMetadata: harnessV1MetadataSchema.optional(),
});

export const harnessV1ErrorPartSchema = z.object({
  type: z.literal('error'),
  error: z.unknown(),
});

export const harnessV1RawPartSchema = z.object({
  type: z.literal('raw'),
  rawValue: z.unknown(),
});

/**
 * Assembled discriminated union over every `HarnessV1StreamPart` variant. Left
 * un-annotated so it keeps its precise inferred type — the protocol layer
 * composes the individual member schemas, and the type test asserts the
 * inferred union equals `HarnessV1StreamPart`.
 */
export const harnessV1StreamPartSchema = z.discriminatedUnion('type', [
  harnessV1StreamStartPartSchema,
  harnessV1TextStartPartSchema,
  harnessV1TextDeltaPartSchema,
  harnessV1TextEndPartSchema,
  harnessV1ReasoningStartPartSchema,
  harnessV1ReasoningDeltaPartSchema,
  harnessV1ReasoningEndPartSchema,
  harnessV1ToolCallPartSchema,
  harnessV1ToolApprovalRequestPartSchema,
  harnessV1ToolResultPartSchema,
  harnessV1FinishStepPartSchema,
  harnessV1FinishPartSchema,
  harnessV1FileChangePartSchema,
  harnessV1CompactionPartSchema,
  harnessV1ErrorPartSchema,
  harnessV1RawPartSchema,
]);

/*
 * Fail-fast guard at the definition site: the schema's output must be
 * assignable to `HarnessV1StreamPart` (catches a schema variant inventing a
 * shape the type does not allow). The reverse direction — the type being a
 * subset of the schema — is covered by the `toEqualTypeOf` assertion in the
 * type test.
 */
const _assignable: z.ZodType<HarnessV1StreamPart> = harnessV1StreamPartSchema;
void _assignable;
