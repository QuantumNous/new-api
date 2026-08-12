import {
  harnessV1BridgeInboundCommandSchemas,
  harnessV1BridgeOutboundMessageSchema,
  harnessV1BridgeReadySchema,
  harnessV1BridgeStartBaseSchema,
} from '@ai-sdk/harness';
import { z } from 'zod/v4';

/*
 * Codex's bridge wire protocol. The outbound events (including `file-change`
 * and the `bridge-thread` resume coordinate), transport frames, shared inbound
 * commands, and `bridge-ready` line all come from the shared `@ai-sdk/harness`
 * protocol — the only Codex-specific piece is the `start` payload.
 */

export const outboundMessageSchema = harnessV1BridgeOutboundMessageSchema;
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export const startMessageSchema = harnessV1BridgeStartBaseSchema.extend({
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  webSearch: z.boolean().optional(),
  // Resume signal. When supplied, the bridge calls
  // `codex.resumeThread(resumeThreadId, …)` instead of starting a fresh thread.
  // The host sources the id from lifecycle state `data` cached from a prior
  // `agent.detach`.
  resumeThreadId: z.string().optional(),
});

export type StartMessage = z.infer<typeof startMessageSchema>;

export const inboundMessageSchema = z.discriminatedUnion('type', [
  startMessageSchema,
  ...harnessV1BridgeInboundCommandSchemas,
]);
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

export const bridgeReadySchema = harnessV1BridgeReadySchema;
export type BridgeReady = z.infer<typeof bridgeReadySchema>;
