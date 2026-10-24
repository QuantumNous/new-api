import {
  executeTool,
  isExecutableTool,
  type Arrayable,
  type Experimental_SandboxSession as SandboxSession,
  type InferToolInput,
  type InferToolSetContext,
  type ModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import {
  getToolTimeoutMs,
  type TimeoutConfiguration,
} from '../prompt/request-options';
import type { TelemetryDispatcher } from '../telemetry/telemetry';
import { getOwn } from '../util/get-own';
import { mergeAbortSignals } from '../util/merge-abort-signals';
import { notify } from '../util/notify';
import { now } from '../util/now';
import type { TypedToolCall } from './tool-call';
import type { TypedToolError } from './tool-error';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from './tool-execution-events';
import type { ToolOutput } from './tool-output';
import type { TypedToolResult } from './tool-result';
import { validateToolContext } from './validate-tool-context';

/**
 * Executes a single tool call and manages its lifecycle callbacks.
 *
 * This function handles the complete tool execution flow:
 * 1. Invokes `onToolExecutionStart` callback before execution
 * 2. Executes the tool's `execute` function with proper context
 * 3. Handles streaming outputs via `onPreliminaryToolResult`
 * 4. Invokes `onToolExecutionEnd` callback with success or error result
 *
 * @returns The tool output with performance metrics, or undefined if the tool has no execute function.
 */
export async function executeToolCall<TOOLS extends ToolSet>({
  toolCall,
  tools,
  toolsContext,
  callId,
  messages,
  abortSignal,
  timeout,
  experimental_sandbox: sandbox,
  onPreliminaryToolResult,
  onToolExecutionStart,
  onToolExecutionEnd,
  executeToolInTelemetryContext = async ({ execute }) => await execute(),
  runInTracingChannelSpan = async ({ execute }) => await execute(),
}: {
  toolCall: TypedToolCall<TOOLS>;
  tools: TOOLS | undefined;
  callId: string;
  messages: ModelMessage[];
  abortSignal: AbortSignal | undefined;
  toolsContext: InferToolSetContext<TOOLS>;
  timeout?: TimeoutConfiguration<TOOLS>;
  experimental_sandbox?: SandboxSession;
  onPreliminaryToolResult?: (result: TypedToolResult<TOOLS>) => void;
  onToolExecutionStart?: Arrayable<OnToolExecutionStartCallback<TOOLS>>;
  onToolExecutionEnd?: Arrayable<OnToolExecutionEndCallback<TOOLS>>;
  executeToolInTelemetryContext?: <T>(
    params: Partial<ToolExecutionStartEvent<TOOLS>> & {
      callId: string;
      toolCallId: string;
      execute: () => PromiseLike<T>;
    },
  ) => PromiseLike<T>;
  runInTracingChannelSpan?: NonNullable<
    TelemetryDispatcher['runInTracingChannelSpan']
  >;
}): Promise<
  | {
      output: ToolOutput<TOOLS>;
      toolExecutionMs: number;
    }
  | undefined
> {
  const { toolName, toolCallId, input } = toolCall;
  const tool = getOwn(tools, toolName);

  if (!isExecutableTool(tool)) {
    return undefined;
  }

  const context = await validateToolContext({
    toolName,
    context: getOwn(toolsContext, toolName),
    contextSchema: tool.contextSchema,
  });

  const toolExecutionContext = {
    toolCall,
    messages,
    toolContext: context,
  };
  const baseCallbackEvent = {
    callId,
    ...toolExecutionContext,
  };

  return await runInTracingChannelSpan({
    type: 'executeTool',
    event: baseCallbackEvent,
    execute: async () => {
      let output: unknown;

      await notify({
        event: baseCallbackEvent as ToolExecutionStartEvent<TOOLS>,
        callbacks: onToolExecutionStart,
      });

      const toolTimeoutMs = getToolTimeoutMs<TOOLS>(timeout, toolName);
      const toolAbortSignal = mergeAbortSignals(abortSignal, toolTimeoutMs);

      let toolExecutionMs = 0;
      try {
        // Integration wrappers keep nested AI SDK calls associated with this tool execution.
        await executeToolInTelemetryContext({
          callId,
          toolCallId,
          ...(toolExecutionContext as Partial<ToolExecutionStartEvent<TOOLS>>),
          execute: async () => {
            const startTime = now();
            try {
              const stream = executeTool({
                tool,
                input: input as InferToolInput<typeof tool>,
                options: {
                  toolCallId,
                  messages,
                  abortSignal: toolAbortSignal,
                  context,
                  experimental_sandbox: sandbox,
                },
              });

              for await (const part of stream) {
                if (part.type === 'preliminary') {
                  onPreliminaryToolResult?.({
                    ...toolCall,
                    type: 'tool-result',
                    output: part.output,
                    preliminary: true,
                  });
                } else {
                  output = part.output;
                }
              }
            } finally {
              toolExecutionMs = now() - startTime;
            }
          },
        });
      } catch (error) {
        const toolError = {
          type: 'tool-error',
          toolCallId,
          toolName,
          input,
          error,
          dynamic: tool.type === 'dynamic',
          ...(toolCall.providerMetadata != null
            ? { providerMetadata: toolCall.providerMetadata }
            : {}),
          ...(toolCall.toolMetadata != null
            ? { toolMetadata: toolCall.toolMetadata }
            : {}),
        } as TypedToolError<TOOLS>;

        await notify({
          event: {
            ...baseCallbackEvent,
            toolOutput: toolError,
            toolExecutionMs,
          } as ToolExecutionEndEvent<TOOLS>,
          callbacks: onToolExecutionEnd,
        });

        return {
          output: toolError,
          toolExecutionMs,
        };
      }

      const toolResult = {
        type: 'tool-result',
        toolCallId,
        toolName,
        input,
        output,
        dynamic: tool.type === 'dynamic',
        ...(toolCall.providerMetadata != null
          ? { providerMetadata: toolCall.providerMetadata }
          : {}),
        ...(toolCall.toolMetadata != null
          ? { toolMetadata: toolCall.toolMetadata }
          : {}),
      } as TypedToolResult<TOOLS>;

      await notify({
        event: {
          ...baseCallbackEvent,
          toolOutput: toolResult,
          toolExecutionMs,
        } as ToolExecutionEndEvent<TOOLS>,
        callbacks: onToolExecutionEnd,
      });

      return {
        output: toolResult,
        toolExecutionMs,
      };
    },
  });
}
