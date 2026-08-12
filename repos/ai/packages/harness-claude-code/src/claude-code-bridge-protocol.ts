import {
  harnessV1BridgeInboundCommandSchemas,
  harnessV1BridgeOutboundMessageSchema,
  harnessV1BridgeReadySchema,
  harnessV1BridgeStartBaseSchema,
} from '@ai-sdk/harness';
import { z } from 'zod/v4';

/*
 * Claude Code's bridge wire protocol. The outbound events, transport frames,
 * shared inbound commands, and `bridge-ready` line all come from the shared
 * `@ai-sdk/harness` protocol — the only Claude-specific piece is the `start`
 * payload, which carries Claude SDK configuration.
 */

export const outboundMessageSchema = harnessV1BridgeOutboundMessageSchema;
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export const startMessageSchema = harnessV1BridgeStartBaseSchema.extend({
  thinking: z.enum(['off', 'on', 'adaptive']).optional(),
  maxTurns: z.number().optional(),
  skills: z.array(z.string()).optional(),
  // Resume signal. When true, the bridge passes `{ continue: true }` to the
  // Claude SDK so the in-workdir thread state is rehydrated. The host sets this
  // on the first prompt after a cross-process resume.
  continue: z.boolean().optional(),
});

export type StartMessage = z.infer<typeof startMessageSchema>;

export const inboundMessageSchema = z.discriminatedUnion('type', [
  startMessageSchema,
  ...harnessV1BridgeInboundCommandSchemas,
]);
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

export const bridgeReadySchema = harnessV1BridgeReadySchema;
export type BridgeReady = z.infer<typeof bridgeReadySchema>;
