import type {
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
  LanguageModelV4Middleware,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';
import {
  createRun,
  createStep,
  updateStepResult,
  notifyServerAsync,
} from './db.js';

const generateId = () => crypto.randomUUID();

// Track active streaming steps for cleanup on process exit
const activeSteps = new Map<
  string,
  {
    startTime: number;
    collectedOutput: unknown;
    request: unknown;
    fullStreamChunks: unknown[];
    rawChunks: unknown[];
  }
>();

// Handle process termination signals
let signalHandlersRegistered = false;
const registerSignalHandlers = () => {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;

  const cleanup = async () => {
    if (activeSteps.size === 0) return;

    const promises = Array.from(activeSteps.entries()).map(
      async ([stepId, data]) => {
        const durationMs = Date.now() - data.startTime;
        await updateStepResult(stepId, {
          duration_ms: durationMs,
          output: JSON.stringify(data.collectedOutput),
          usage: null,
          error: 'Request aborted',
          raw_request:
            data.request &&
            typeof data.request === 'object' &&
            'body' in data.request
              ? JSON.stringify((data.request as { body: unknown }).body)
              : null,
          raw_response: JSON.stringify(data.fullStreamChunks),
          raw_chunks: JSON.stringify(data.rawChunks),
        });
      },
    );
    await Promise.all(promises);

    // Wait for the server notification to complete before process exits
    await notifyServerAsync('step-update');
  };

  process.on('SIGINT', () => {
    cleanup().then(() => process.exit(130));
  });

  process.on('SIGTERM', () => {
    cleanup().then(() => process.exit(143));
  });
};

/**
 * Generate a unique run ID with timestamp prefix for sorting.
 */
const generateRunId = (): string => {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 17);
  const uniqueId = crypto.randomUUID().slice(0, 8);
  return `${timestamp}-${uniqueId}`;
};

/**
 * Factory function that creates a devtools middleware instance.
 * Each call generates a unique run ID, so all steps within a single
 * streamText/generateText call share the same run.
 *
 * Usage:
 * ```ts
 * const result = streamText({
 *   model: wrapLanguageModel({
 *     middleware: devToolsMiddleware(),
 *     model: yourModel,
 *   }),
 *   prompt: "...",
 * });
 * ```
 */
export const devToolsMiddleware = (): LanguageModelV4Middleware => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '@ai-sdk/devtools should not be used in production. ' +
        'Remove devToolsMiddleware from your model configuration for production builds.',
    );
  }

  // Register signal handlers once for cleanup on process exit
  registerSignalHandlers();

  const runId = generateRunId();
  let runCreated = false;
  let stepCounter = 0;

  const ensureRunCreated = async () => {
    if (!runCreated) {
      await createRun(runId);
      runCreated = true;
    }
  };

  const getNextStepNumber = () => {
    stepCounter++;
    return stepCounter;
  };

  return {
    specificationVersion: 'v4',

    wrapGenerate: async ({ doGenerate, params, model }) => {
      const startTime = Date.now();
      const stepId = generateId();
      const stepNumber = getNextStepNumber();
      await ensureRunCreated();

      // Log step start
      await createStep({
        id: stepId,
        run_id: runId,
        step_number: stepNumber,
        type: 'generate',
        model_id: model.modelId,
        // @ts-expect-error broken type
        provider: model.config?.provider,
        started_at: new Date().toISOString(),
        input: JSON.stringify({
          prompt: params.prompt,
          tools: params.tools,
          toolChoice: params.toolChoice,
          maxOutputTokens: params.maxOutputTokens,
          temperature: params.temperature,
          topP: params.topP,
          topK: params.topK,
          presencePenalty: params.presencePenalty,
          frequencyPenalty: params.frequencyPenalty,
          seed: params.seed,
          responseFormat: params.responseFormat,
        }),
        provider_options: params.providerOptions
          ? JSON.stringify(params.providerOptions)
          : null,
      });

      try {
        const result = await doGenerate();
        const durationMs = Date.now() - startTime;

        await updateStepResult(stepId, {
          duration_ms: durationMs,
          output: JSON.stringify({
            content: result.content,
            finishReason: result.finishReason,
            response: result.response,
          }),
          usage: result.usage ? JSON.stringify(result.usage) : null,
          error: null,
          raw_request: result.request?.body
            ? JSON.stringify(result.request.body)
            : null,
          raw_response: result.response?.body
            ? JSON.stringify(result.response.body)
            : null,
        });

        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        await updateStepResult(stepId, {
          duration_ms: durationMs,
          output: null,
          usage: null,
          error: error instanceof Error ? error.message : String(error),
          raw_request: null,
          raw_response: null,
        });
        throw error;
      }
    },

    wrapStream: async ({ doStream, params, model }) => {
      const startTime = Date.now();
      const stepId = generateId();
      const stepNumber = getNextStepNumber();
      await ensureRunCreated();

      // Store original setting before overriding
      const userRequestedRawChunks = params.includeRawChunks === true;
      params.includeRawChunks = true;

      // Log step start
      await createStep({
        id: stepId,
        run_id: runId,
        step_number: stepNumber,
        type: 'stream',
        model_id: model.modelId,
        // @ts-expect-error broken type
        provider: model.config?.provider,
        started_at: new Date().toISOString(),
        input: JSON.stringify({
          prompt: params.prompt,
          tools: params.tools,
          toolChoice: params.toolChoice,
          maxOutputTokens: params.maxOutputTokens,
          temperature: params.temperature,
          topP: params.topP,
          topK: params.topK,
          presencePenalty: params.presencePenalty,
          frequencyPenalty: params.frequencyPenalty,
          seed: params.seed,
          responseFormat: params.responseFormat,
        }),
        provider_options: params.providerOptions
          ? JSON.stringify(params.providerOptions)
          : null,
      });

      try {
        const { stream, request, response, ...rest } = await doStream();

        // Collect stream output for logging
        const collectedOutput: {
          textParts: Array<{ id: string; text: string }>;
          reasoningParts: Array<{ id: string; text: string }>;
          toolCalls: LanguageModelV4StreamPart[];
          finishReason?: LanguageModelV4FinishReason;
          usage?: LanguageModelV4Usage;
        } = {
          textParts: [],
          reasoningParts: [],
          toolCalls: [],
        };

        const currentText: Map<string, string> = new Map();
        const currentReasoning: Map<string, string> = new Map();
        const fullStreamChunks: LanguageModelV4StreamPart[] = [];
        const rawChunks: unknown[] = [];

        // Track this step for cleanup on process exit
        activeSteps.set(stepId, {
          startTime,
          collectedOutput,
          request,
          fullStreamChunks,
          rawChunks,
        });

        const transformStream = new TransformStream<
          LanguageModelV4StreamPart,
          LanguageModelV4StreamPart
        >({
          transform(chunk, controller) {
            // Separate raw provider chunks from other stream chunks
            if (chunk.type === 'raw') {
              // Store just the unwrapped rawValue for cleaner data
              rawChunks.push(chunk.rawValue);
              // Only pass raw chunks through if user originally requested them
              if (userRequestedRawChunks) {
                controller.enqueue(chunk);
              }
              return;
            }

            // Collect all non-raw chunks for full stream logging
            fullStreamChunks.push(chunk);

            // Collect relevant data from stream
            switch (chunk.type) {
              case 'text-start':
                currentText.set(chunk.id, '');
                break;
              case 'text-delta':
                currentText.set(
                  chunk.id,
                  (currentText.get(chunk.id) ?? '') + chunk.delta,
                );
                break;
              case 'text-end':
                collectedOutput.textParts.push({
                  id: chunk.id,
                  text: currentText.get(chunk.id) ?? '',
                });
                break;
              case 'reasoning-start':
                currentReasoning.set(chunk.id, '');
                break;
              case 'reasoning-delta':
                currentReasoning.set(
                  chunk.id,
                  (currentReasoning.get(chunk.id) ?? '') + chunk.delta,
                );
                break;
              case 'reasoning-end':
                collectedOutput.reasoningParts.push({
                  id: chunk.id,
                  text: currentReasoning.get(chunk.id) ?? '',
                });
                break;
              case 'tool-call':
                collectedOutput.toolCalls.push(chunk);
                break;
              case 'finish':
                collectedOutput.finishReason = chunk.finishReason;
                collectedOutput.usage = chunk.usage;
                break;
            }

            controller.enqueue(chunk);
          },

          async flush() {
            // Remove from active tracking - stream completed normally
            activeSteps.delete(stepId);

            const durationMs = Date.now() - startTime;
            await updateStepResult(stepId, {
              duration_ms: durationMs,
              output: JSON.stringify(collectedOutput),
              usage: collectedOutput.usage
                ? JSON.stringify(collectedOutput.usage)
                : null,
              error: null,
              raw_request: request?.body ? JSON.stringify(request.body) : null,
              raw_response: JSON.stringify(fullStreamChunks),
              raw_chunks: JSON.stringify(rawChunks),
            });
          },

          // @ts-expect-error - cancel is valid per WHATWG Streams spec but missing from TS types
          async cancel() {
            // Remove from active tracking - stream was cancelled
            activeSteps.delete(stepId);

            const durationMs = Date.now() - startTime;
            await updateStepResult(stepId, {
              duration_ms: durationMs,
              output: JSON.stringify(collectedOutput),
              usage: collectedOutput.usage
                ? JSON.stringify(collectedOutput.usage)
                : null,
              error: 'Request aborted',
              raw_request: request?.body ? JSON.stringify(request.body) : null,
              raw_response: JSON.stringify(fullStreamChunks),
              raw_chunks: JSON.stringify(rawChunks),
            });
          },
        });

        return {
          stream: stream.pipeThrough(transformStream),
          request,
          response,
          ...rest,
        };
      } catch (error) {
        activeSteps.delete(stepId);

        const durationMs = Date.now() - startTime;
        await updateStepResult(stepId, {
          duration_ms: durationMs,
          output: null,
          usage: null,
          error: error instanceof Error ? error.message : String(error),
          raw_request: null,
          raw_response: null,
          raw_chunks: null,
        });
        throw error;
      }
    },
  };
};
