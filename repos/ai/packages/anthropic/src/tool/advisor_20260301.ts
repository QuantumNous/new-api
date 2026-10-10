import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const advisor_20260301ArgsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      model: z.string(),
      maxUses: z.number().optional(),
      caching: z
        .object({
          type: z.literal('ephemeral'),
          ttl: z.union([z.literal('5m'), z.literal('1h')]),
        })
        .optional(),
    }),
  ),
);

export const advisor_20260301OutputSchema = lazySchema(() =>
  zodSchema(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('advisor_result'),
        text: z.string(),
      }),
      z.object({
        type: z.literal('advisor_redacted_result'),
        encryptedContent: z.string(),
      }),
      z.object({
        type: z.literal('advisor_tool_result_error'),
        errorCode: z.string(),
      }),
    ]),
  ),
);

const advisor_20260301InputSchema = lazySchema(() =>
  zodSchema(z.object({}).strict()),
);

const factory = createProviderExecutedToolFactory<
  // Input is always empty: the executor emits server_tool_use with empty input
  // and the server constructs the advisor's view from the full transcript.
  {},
  | {
      type: 'advisor_result';

      /**
       * Plaintext advice from the advisor model.
       */
      text: string;
    }
  | {
      type: 'advisor_redacted_result';

      /**
       * Opaque, encrypted advice. Must be round-tripped verbatim on subsequent
       * turns; the server decrypts it server-side when rendering the advisor's
       * advice into the executor's prompt.
       */
      encryptedContent: string;
    }
  | {
      type: 'advisor_tool_result_error';

      /**
       * Available options: `max_uses_exceeded`, `too_many_requests`,
       * `overloaded`, `prompt_too_long`, `execution_time_exceeded`,
       * `unavailable`.
       */
      errorCode: string;
    },
  {
    /**
     * The advisor model ID, such as `"claude-opus-4-8"`. Billed at this
     * model's rates for the sub-inference.
     *
     * The advisor must be at least as capable as the executor; an invalid
     * pair returns a `400 invalid_request_error` from the API.
     */
    model: string;

    /**
     * Maximum number of advisor calls allowed in a single request. Once the
     * executor reaches this cap, further advisor calls return an
     * `advisor_tool_result_error` with `error_code: "max_uses_exceeded"` and
     * the executor continues without further advice.
     *
     * This is a per-request cap, not a per-conversation cap. To enforce
     * conversation-level limits, count advisor calls client-side; when you
     * hit your cap, remove the advisor tool from `tools` AND strip all
     * `advisor_tool_result` blocks from your message history (otherwise the
     * API returns `400 invalid_request_error`).
     */
    maxUses?: number;

    /**
     * Enables prompt caching for the advisor's own transcript across calls
     * within a conversation. Unlike `cache_control` on content blocks, this
     * is not a breakpoint marker; it is an on/off switch. The server decides
     * where cache boundaries go.
     *
     * The cache write costs more than the reads save when the advisor is
     * called two or fewer times per conversation; caching breaks even at
     * roughly three advisor calls. Enable it for long agent loops; keep it
     * off for short tasks. Keep it consistent across a conversation —
     * toggling causes cache misses.
     */
    caching?: {
      type: 'ephemeral';
      ttl: '5m' | '1h';
    };
  }
>({
  id: 'anthropic.advisor_20260301',
  inputSchema: advisor_20260301InputSchema,
  outputSchema: advisor_20260301OutputSchema,
  supportsDeferredResults: true,
});

export const advisor_20260301 = (args: Parameters<typeof factory>[0]) => {
  return factory(args);
};
