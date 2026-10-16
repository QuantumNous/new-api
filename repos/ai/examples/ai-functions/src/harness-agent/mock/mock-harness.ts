import type {
  HarnessAgentAdapter,
  HarnessAgentAdapterSession,
  HarnessAgentStreamPart,
} from '@ai-sdk/harness/agent';
import {
  isLoopFinished,
  streamText,
  type AssistantModelMessage,
  type LanguageModel,
  type ModelMessage,
  type TextStreamPart,
  type ToolModelMessage,
  type ToolSet,
} from 'ai';

/**
 * Mock harness for testing `HarnessAgent` end-to-end against real provider
 * APIs. Wraps `streamText` under the hood and translates its stream parts
 * back into `HarnessAgentStreamPart` events so the surrounding `HarnessAgent`
 * plumbing exercises its real translation + multi-turn machinery.
 *
 * Caveat: tool execution is delegated to `streamText` itself rather than
 * round-tripping through `HarnessAgent`'s host-tool path. That keeps the
 * mock simple while still validating: streaming, reasoning, multi-step,
 * sticky session, finish/usage propagation. The host-tool round-trip is
 * covered separately by `HarnessAgent`'s unit tests with a synthetic
 * adapter.
 */
export function mockHarness(options: {
  model: LanguageModel;
  tools?: ToolSet;
  providerOptions?: Parameters<typeof streamText>[0]['providerOptions'];
}): HarnessAgentAdapter {
  return {
    specificationVersion: 'harness-v1',
    harnessId: 'mock',
    builtinTools: {},
    doStart: async startOpts => {
      // Per-session conversation history. `HarnessAgent`'s caller passes one
      // new user-message prompt per call; we accumulate prior assistant + tool
      // messages so the underlying model has the full context.
      const history: ModelMessage[] = [];

      const session: HarnessAgentAdapterSession = {
        sessionId: startOpts.sessionId,
        isResume: false,
        doPromptTurn: async promptOpts => {
          history.push(...(promptOpts.prompt as unknown as ModelMessage[]));

          const result = streamText({
            model: options.model,
            messages: history,
            system: promptOpts.instructions,
            tools: options.tools,
            providerOptions: options.providerOptions,
            abortSignal: promptOpts.abortSignal,
            // Let the model's own finish reason drive turn termination so
            // tool-call → tool-result → follow-up text flows naturally.
            stopWhen: isLoopFinished(),
          });

          const done = (async () => {
            try {
              for await (const part of result.fullStream) {
                const event = translateBackward(part);
                if (event != null) promptOpts.emit(event);
              }
              const responseMessages = await result.responseMessages;
              history.push(
                ...(responseMessages as Array<
                  AssistantModelMessage | ToolModelMessage
                >),
              );
            } catch (err) {
              promptOpts.emit({ type: 'error', error: err });
              throw err;
            }
          })();

          return {
            submitToolResult: async () => {
              // streamText drives tool execution itself, so the host
              // never has to submit results in this mock setup.
            },
            done,
          };
        },
        doContinueTurn: async () => {
          // The mock drives each turn via a fresh `streamText` call, so there is
          // no in-flight turn to attach to — a continue resolves immediately.
          return {
            submitToolResult: async () => {},
            done: Promise.resolve(),
          };
        },
        doCompact: async () => {
          // The mock harness has no underlying runtime to compact.
        },
        doDetach: async () => ({
          type: 'resume-session',
          harnessId: 'mock',
          specificationVersion: 'harness-v1',
          data: {},
        }),
        doStop: async () => ({
          // streamText is per-call; nothing persistent to stop.
          type: 'resume-session',
          harnessId: 'mock',
          specificationVersion: 'harness-v1',
          data: {},
        }),
        doDestroy: async () => {
          // streamText is per-call; nothing persistent to destroy.
        },
        doSuspendTurn: async () => ({
          type: 'continue-turn',
          harnessId: 'mock',
          specificationVersion: 'harness-v1',
          data: {},
        }),
      };
      return session;
    },
  };
}

/**
 * Reverse of `@ai-sdk/harness-agent`'s `translateStreamPart`: maps each AI
 * SDK `TextStreamPart` back to a `HarnessAgentStreamPart` so it can flow
 * through the harness contract.
 */
function translateBackward(
  part: TextStreamPart<ToolSet>,
): HarnessAgentStreamPart | null {
  switch (part.type) {
    case 'start':
      return { type: 'stream-start' };

    case 'text-start':
      return { type: 'text-start', id: part.id };
    case 'text-delta':
      return { type: 'text-delta', id: part.id, delta: part.text };
    case 'text-end':
      return { type: 'text-end', id: part.id };

    case 'reasoning-start':
      return { type: 'reasoning-start', id: part.id };
    case 'reasoning-delta':
      return { type: 'reasoning-delta', id: part.id, delta: part.text };
    case 'reasoning-end':
      return { type: 'reasoning-end', id: part.id };

    case 'tool-call':
      return {
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input:
          typeof part.input === 'string'
            ? part.input
            : JSON.stringify(part.input),
        providerExecuted: true, // streamText already executed it
      };
    case 'tool-result':
      return {
        type: 'tool-result',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        result: part.output as Extract<
          HarnessAgentStreamPart,
          { type: 'tool-result' }
        >['result'],
      };

    case 'finish-step':
      return {
        type: 'finish-step',
        finishReason: {
          unified: part.finishReason,
          raw: part.rawFinishReason,
        },
        usage: {
          inputTokens: {
            total: part.usage.inputTokens,
            noCache: part.usage.inputTokenDetails?.noCacheTokens,
            cacheRead: part.usage.inputTokenDetails?.cacheReadTokens,
            cacheWrite: part.usage.inputTokenDetails?.cacheWriteTokens,
          },
          outputTokens: {
            total: part.usage.outputTokens,
            text: part.usage.outputTokenDetails?.textTokens,
            reasoning: part.usage.outputTokenDetails?.reasoningTokens,
          },
        },
      };
    case 'finish':
      return {
        type: 'finish',
        finishReason: {
          unified: part.finishReason,
          raw: part.rawFinishReason,
        },
        totalUsage: {
          inputTokens: {
            total: part.totalUsage.inputTokens,
            noCache: part.totalUsage.inputTokenDetails?.noCacheTokens,
            cacheRead: part.totalUsage.inputTokenDetails?.cacheReadTokens,
            cacheWrite: part.totalUsage.inputTokenDetails?.cacheWriteTokens,
          },
          outputTokens: {
            total: part.totalUsage.outputTokens,
            text: part.totalUsage.outputTokenDetails?.textTokens,
            reasoning: part.totalUsage.outputTokenDetails?.reasoningTokens,
          },
        },
      };

    case 'error':
      return { type: 'error', error: part.error };

    case 'raw':
      return { type: 'raw', rawValue: part.rawValue };

    default:
      // start-step / tool-input-* / source / file / tool-error / approval-*
      // / custom: not surfaced in the v0 mock.
      return null;
  }
}
