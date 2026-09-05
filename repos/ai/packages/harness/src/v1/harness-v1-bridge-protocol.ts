import { z } from 'zod/v4';
import {
  harnessV1DebugConfigSchema,
  harnessV1DebugLevelSchema,
  type HarnessV1Diagnostic,
} from './harness-v1-diagnostic';
import {
  harnessV1CompactionPartSchema,
  harnessV1ErrorPartSchema,
  harnessV1FileChangePartSchema,
  harnessV1FinishPartSchema,
  harnessV1FinishStepPartSchema,
  harnessV1RawPartSchema,
  harnessV1ReasoningDeltaPartSchema,
  harnessV1ReasoningEndPartSchema,
  harnessV1ReasoningStartPartSchema,
  harnessV1StreamStartPartSchema,
  harnessV1TextDeltaPartSchema,
  harnessV1TextEndPartSchema,
  harnessV1TextStartPartSchema,
  harnessV1ToolApprovalRequestPartSchema,
  harnessV1ToolCallPartSchema,
  harnessV1ToolResultPartSchema,
} from './harness-v1-stream-part';

/*
 * The bridge wire protocol shared by every bridge-backed harness adapter.
 *
 * This is the serialization of the host<->runtime contract for adapters that
 * run the agent runtime inside the sandbox and talk to the host over a
 * WebSocket. It exists ONLY because of that transport: untrusted JSON frames
 * crossing the sandbox boundary need runtime validation, the connection needs
 * a handshake, and the host drives turns with serialized commands. Every export
 * here is therefore prefixed `harnessV1Bridge…`.
 *
 * It has three tiers:
 *
 *  1. The OUTBOUND events — `HarnessV1StreamPart` re-expressed as Zod (imported
 *     member schemas from `harness-v1-stream-part.ts`), because the part type is
 *     compile-time only and the frames need runtime validation at the boundary.
 *  2. The transport/control frames that are NOT consumer events — `bridge-hello`
 *     (handshake), `bridge-detach` (resume payload), `bridge-thread` (a resume
 *     coordinate some runtimes announce). These ride the same socket.
 *  3. The INBOUND command vocabulary the host sends back: the shared commands
 *     live here; the per-adapter `start` payload extends
 *     `harnessV1BridgeStartBaseSchema` and assembles the final inbound union in
 *     the adapter package.
 *
 * Non-bridge adapters (e.g. Pi) do not use this layer at all — they have no
 * serialization boundary and target the universal `HarnessV1StreamPart` type
 * directly. That is the deliberate split: `harness-v1-stream-part.ts` is the
 * transport-agnostic event vocabulary; this file is the bridge transport.
 */

/**
 * The subset of a host-defined tool that travels on the `start` message. The
 * runtime only needs the name, description, and JSON-Schema input to surface
 * the tool; `execute` stays on the host.
 */
export const harnessV1BridgeToolWireSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
});

export type HarnessV1BridgeToolWire = z.infer<
  typeof harnessV1BridgeToolWireSchema
>;

export const harnessV1BridgePermissionModeSchema = z.enum([
  'allow-reads',
  'allow-edits',
  'allow-all',
]);

export const harnessV1BridgeBuiltinToolFilteringSchema = z.discriminatedUnion(
  'mode',
  [
    z.object({
      mode: z.literal('allow'),
      toolNames: z.array(z.string()),
    }),
    z.object({
      mode: z.literal('deny'),
      toolNames: z.array(z.string()),
    }),
  ],
);

/**
 * Common fields of the inbound `start` message. Each adapter extends this with
 * its runtime-specific configuration (e.g. `thinking`/`continue` for Claude
 * Code, `reasoningEffort`/`webSearch`/`skills`/`resumeThreadId` for Codex) and
 * assembles the final inbound union from the shared command members below.
 *
 * `debug` carries the general `HarnessV1DebugConfig` — diagnostics config is not
 * a bridge concept, it just happens to ride the `start` frame for bridge-backed
 * adapters.
 */
export const harnessV1BridgeStartBaseSchema = z.object({
  type: z.literal('start'),
  prompt: z.string(),
  tools: z.array(harnessV1BridgeToolWireSchema).optional(),
  model: z.string().optional(),
  debug: harnessV1DebugConfigSchema.optional(),
  permissionMode: harnessV1BridgePermissionModeSchema.optional(),
  builtinToolFiltering: harnessV1BridgeBuiltinToolFilteringSchema.optional(),
});

// --- Transport / control frames (outbound, not consumer events) ---

/**
 * Sent the instant the bridge accepts an authenticated WS connection. The host
 * waits for it before sending `start`/`resume`, because some sandbox runtimes
 * complete the upstream WS handshake before the connection is wired through to
 * the bridge process — anything sent in that gap is dropped. Carries the
 * bridge's lifecycle `state` and highest emitted `seq` for reconnect.
 */
export const harnessV1BridgeHelloSchema = z.object({
  type: z.literal('bridge-hello'),
  state: z.string().optional(),
  lastSeq: z.number().optional(),
});

/**
 * The bridge's reply to an inbound `detach`. Carries the adapter-specific
 * payload the host serializes into lifecycle state `data`.
 */
export const harnessV1BridgeDetachSchema = z.object({
  type: z.literal('bridge-detach'),
  data: z.unknown(),
});

/**
 * A resume coordinate the bridge proactively announces (e.g. Codex's thread id)
 * so the host can cache it for a later resume without waiting for `detach`.
 */
export const harnessV1BridgeThreadSchema = z.object({
  type: z.literal('bridge-thread'),
  threadId: z.string(),
});

/**
 * Acknowledgement for an inbound `interrupt` command. The host waits for this
 * before freezing its replay cursor so the adapter-specific interrupt has
 * actually reached the underlying runtime.
 */
export const harnessV1BridgeInterruptedSchema = z.object({
  type: z.literal('bridge-interrupted'),
  ok: z.boolean(),
  error: z.unknown().optional(),
});

// --- Diagnostics frames (outbound, not consumer events) ---

/**
 * One captured console line from inside the sandbox. The bridge line-buffers
 * `process.stdout`/`process.stderr` and emits one of these per complete line.
 * Routed host-side to the diagnostics sink, never to the consumer stream.
 */
export const harnessV1BridgeSandboxLogSchema = z.object({
  type: z.literal('sandbox-log'),
  source: z.string(),
  stream: z.enum(['stdout', 'stderr']),
  line: z.string(),
});

/**
 * A structured diagnostic an adapter emits from inside the bridge via
 * `turn.bridgeLog(...)`. Gated by the session's debug level + subsystem filter.
 */
export const harnessV1BridgeDebugEventSchema = z.object({
  type: z.literal('debug-event'),
  level: harnessV1DebugLevelSchema,
  subsystem: z.string(),
  message: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      name: z.string().optional(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});

/**
 * Every frame a bridge can send to the host: the stream-part events plus the
 * transport/control frames. This is the schema the host `SandboxChannel`
 * validates inbound frames against.
 */
export const harnessV1BridgeOutboundMessageSchema = z.discriminatedUnion(
  'type',
  [
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
    harnessV1BridgeHelloSchema,
    harnessV1BridgeDetachSchema,
    harnessV1BridgeThreadSchema,
    harnessV1BridgeInterruptedSchema,
    harnessV1BridgeSandboxLogSchema,
    harnessV1BridgeDebugEventSchema,
  ],
);

export type HarnessV1BridgeOutboundMessage = z.infer<
  typeof harnessV1BridgeOutboundMessageSchema
>;

export type HarnessV1BridgeSandboxLog = z.infer<
  typeof harnessV1BridgeSandboxLogSchema
>;

export type HarnessV1BridgeDebugEvent = z.infer<
  typeof harnessV1BridgeDebugEventSchema
>;

/**
 * Normalize a bridge diagnostics wire frame into the transport-agnostic
 * `HarnessV1Diagnostic` an adapter reports to the framework. A captured console
 * line maps `stderr` → `warn` and `stdout` → `info`; a structured event passes
 * its fields through. This is the seam where the bridge's serialization is
 * lifted into the general emission shape every harness shares.
 */
export function harnessV1DiagnosticFromBridgeFrame(
  frame: HarnessV1BridgeSandboxLog | HarnessV1BridgeDebugEvent,
  context: { sessionId?: string; timestamp: number },
): HarnessV1Diagnostic {
  if (frame.type === 'sandbox-log') {
    return {
      level: frame.stream === 'stderr' ? 'warn' : 'info',
      message: frame.line,
      subsystem: `sandbox.log.${frame.source}`,
      kind: 'log',
      source: frame.source,
      stream: frame.stream,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
    };
  }
  return {
    level: frame.level,
    message: frame.message,
    subsystem: frame.subsystem,
    kind: 'event',
    attrs: frame.attrs,
    error: frame.error,
    sessionId: context.sessionId,
    timestamp: context.timestamp,
  };
}

// --- Shared inbound command members (host -> bridge) ---

export const harnessV1BridgeToolResultInboundSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  output: z.unknown(),
  isError: z.boolean().optional(),
});

export const harnessV1BridgeToolApprovalResponseInboundSchema = z.object({
  type: z.literal('tool-approval-response'),
  approvalId: z.string(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

export const harnessV1BridgeUserMessageInboundSchema = z.object({
  type: z.literal('user-message'),
  text: z.string(),
});

export const harnessV1BridgeAbortInboundSchema = z.object({
  type: z.literal('abort'),
});

export const harnessV1BridgeInterruptInboundSchema = z.object({
  type: z.literal('interrupt'),
});

export const harnessV1BridgeShutdownInboundSchema = z.object({
  type: z.literal('shutdown'),
});

/**
 * Reconnect: after re-establishing the socket the host asks the bridge to
 * replay every buffered event with `seq > lastSeenEventId`.
 */
export const harnessV1BridgeResumeInboundSchema = z.object({
  type: z.literal('resume'),
  lastSeenEventId: z.number(),
});

/**
 * The bridge replies with `bridge-detach` carrying any cached resume payload,
 * then exits.
 */
export const harnessV1BridgeDetachInboundSchema = z.object({
  type: z.literal('detach'),
});

/**
 * The inbound command members shared by every bridge adapter. Spread these
 * alongside the adapter's own `start` schema to build the final inbound union:
 * `z.discriminatedUnion('type', [adapterStartSchema, ...harnessV1BridgeInboundCommandSchemas])`.
 */
export const harnessV1BridgeInboundCommandSchemas = [
  harnessV1BridgeToolResultInboundSchema,
  harnessV1BridgeToolApprovalResponseInboundSchema,
  harnessV1BridgeUserMessageInboundSchema,
  harnessV1BridgeAbortInboundSchema,
  harnessV1BridgeInterruptInboundSchema,
  harnessV1BridgeShutdownInboundSchema,
  harnessV1BridgeResumeInboundSchema,
  harnessV1BridgeDetachInboundSchema,
] as const;

/**
 * The JSON line the bridge writes to stdout once its WebSocket server is bound,
 * announcing the port the host should connect to.
 */
export const harnessV1BridgeReadySchema = z.object({
  type: z.literal('bridge-ready'),
  port: z.number(),
});

export type HarnessV1BridgeReady = z.infer<typeof harnessV1BridgeReadySchema>;
