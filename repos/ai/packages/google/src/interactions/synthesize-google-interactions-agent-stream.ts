import type {
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import { convertGoogleInteractionsUsage } from './convert-google-interactions-usage';
import { type GoogleInteractionsResponse } from './google-interactions-api';
import { mapGoogleInteractionsFinishReason } from './map-google-interactions-finish-reason';
import { parseGoogleInteractionsOutputs } from './parse-google-interactions-outputs';

/**
 * Synthesizes a `LanguageModelV4StreamPart` stream from a fully-resolved
 * Interaction response (i.e. the `response` returned after polling a
 * `background: true` agent call to a terminal status).
 *
 * Agent calls cannot use SSE (`stream: true` is incompatible with
 * `background: true`), so we deterministically replay the polled outputs as a
 * stream sequence in the same order/shape `buildGoogleInteractionsStreamTransform`
 * would produce. Each text/reasoning block is emitted as a single delta — the
 * server has already produced the whole block by the time we synthesize.
 */
export function synthesizeGoogleInteractionsAgentStream({
  response,
  warnings,
  generateId,
  includeRawChunks,
  headerServiceTier,
}: {
  response: GoogleInteractionsResponse;
  warnings: Array<SharedV4Warning>;
  generateId: () => string;
  includeRawChunks?: boolean;
  headerServiceTier?: string;
}): ReadableStream<LanguageModelV4StreamPart> {
  return new ReadableStream<LanguageModelV4StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings });

      const interactionId =
        typeof response.id === 'string' && response.id.length > 0
          ? response.id
          : undefined;

      let timestamp: Date | undefined;
      const created = response.created;
      if (typeof created === 'string') {
        const parsed = new Date(created);
        if (!Number.isNaN(parsed.getTime())) {
          timestamp = parsed;
        }
      }

      controller.enqueue({
        type: 'response-metadata',
        ...(interactionId != null ? { id: interactionId } : {}),
        modelId: response.model ?? undefined,
        ...(timestamp ? { timestamp } : {}),
      });

      if (includeRawChunks) {
        controller.enqueue({ type: 'raw', rawValue: response });
      }

      const { content, hasFunctionCall } = parseGoogleInteractionsOutputs({
        steps: response.steps ?? null,
        generateId,
        interactionId,
      });

      let blockCounter = 0;
      const nextBlockId = () => `${interactionId ?? 'agent'}:${blockCounter++}`;

      for (const part of content) {
        switch (part.type) {
          case 'text': {
            const id = nextBlockId();
            const providerMetadata = part.providerMetadata;
            controller.enqueue({ type: 'text-start', id });
            if (part.text.length > 0) {
              controller.enqueue({ type: 'text-delta', id, delta: part.text });
            }
            controller.enqueue({
              type: 'text-end',
              id,
              ...(providerMetadata ? { providerMetadata } : {}),
            });
            break;
          }
          case 'reasoning': {
            const id = nextBlockId();
            const providerMetadata = part.providerMetadata;
            controller.enqueue({ type: 'reasoning-start', id });
            if (part.text.length > 0) {
              controller.enqueue({
                type: 'reasoning-delta',
                id,
                delta: part.text,
              });
            }
            controller.enqueue({
              type: 'reasoning-end',
              id,
              ...(providerMetadata ? { providerMetadata } : {}),
            });
            break;
          }
          case 'tool-call': {
            const providerMetadata = part.providerMetadata;
            controller.enqueue({
              type: 'tool-input-start',
              id: part.toolCallId,
              toolName: part.toolName,
              ...(part.providerExecuted
                ? { providerExecuted: part.providerExecuted }
                : {}),
            });
            controller.enqueue({
              type: 'tool-input-delta',
              id: part.toolCallId,
              delta: part.input,
            });
            controller.enqueue({
              type: 'tool-input-end',
              id: part.toolCallId,
            });
            controller.enqueue({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
              ...(part.providerExecuted
                ? { providerExecuted: part.providerExecuted }
                : {}),
              ...(providerMetadata ? { providerMetadata } : {}),
            });
            break;
          }
          case 'tool-result': {
            controller.enqueue({
              type: 'tool-result',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: part.result,
            });
            break;
          }
          case 'source':
          case 'file': {
            controller.enqueue(part);
            break;
          }
          default:
            break;
        }
      }

      const serviceTier = response.service_tier ?? headerServiceTier;

      const finishReason: LanguageModelV4FinishReason = {
        unified: mapGoogleInteractionsFinishReason({
          status: response.status,
          hasFunctionCall,
        }),
        raw: response.status,
      };

      const providerMetadata: SharedV4ProviderMetadata = {
        google: {
          ...(interactionId != null ? { interactionId } : {}),
          ...(serviceTier != null ? { serviceTier } : {}),
        },
      };

      controller.enqueue({
        type: 'finish',
        finishReason,
        usage: convertGoogleInteractionsUsage(response.usage),
        providerMetadata,
      });

      controller.close();
    },
  });
}
