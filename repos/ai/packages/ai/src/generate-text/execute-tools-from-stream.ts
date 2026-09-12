import type {
  Arrayable,
  Context,
  IdGenerator,
  InferToolSetContext,
  ModelMessage,
  Experimental_SandboxSession as SandboxSession,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { TimeoutConfiguration } from '../prompt/request-options';
import type { Telemetry, TelemetryDispatcher } from '../telemetry/telemetry';
import { getOwn } from '../util/get-own';
import { executeToolCall } from './execute-tool-call';
import { resolveToolApproval } from './resolve-tool-approval';
import type { LanguageModelStreamPart } from './stream-language-model-call';
import { maybeSignApproval } from './tool-approval-signature';
import type { ToolApprovalConfiguration } from './tool-approval-configuration';
import type { TypedToolCall } from './tool-call';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from './tool-execution-events';

export type ToolExecutionEndStreamPart = {
  type: 'tool-execution-end';
  toolCallId: string;
  toolExecutionMs: number;
};

export type ExecuteToolsStreamPart<TOOLS extends ToolSet = ToolSet> =
  | LanguageModelStreamPart<TOOLS>
  | ToolExecutionEndStreamPart;

export function executeToolsFromStream<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context | unknown | never,
>({
  stream,
  tools,
  callId,
  messages,
  abortSignal,
  timeout,
  experimental_sandbox: sandbox,
  toolsContext,
  toolApproval,
  runtimeContext,
  toolApprovalSecret,
  generateId,
  onToolExecutionStart,
  onToolExecutionEnd,
  executeToolInTelemetryContext,
  runInTracingChannelSpan,
}: {
  stream: ReadableStream<LanguageModelStreamPart<TOOLS>>;
  tools: TOOLS | undefined;
  callId: string;
  messages: ModelMessage[];
  abortSignal: AbortSignal | undefined;
  timeout?: TimeoutConfiguration<TOOLS>;
  experimental_sandbox?: SandboxSession;
  toolsContext: InferToolSetContext<TOOLS>;
  toolApproval?: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT>;
  runtimeContext: RUNTIME_CONTEXT;
  toolApprovalSecret?: string | Uint8Array;
  generateId: IdGenerator;
  onToolExecutionStart?: Arrayable<OnToolExecutionStartCallback<TOOLS>>;
  onToolExecutionEnd?: Arrayable<OnToolExecutionEndCallback<TOOLS>>;
  executeToolInTelemetryContext?: Telemetry['executeTool'];
  runInTracingChannelSpan?: NonNullable<
    TelemetryDispatcher['runInTracingChannelSpan']
  >;
}): ReadableStream<ExecuteToolsStreamPart<TOOLS>> {
  const toolCallsToExecute: Array<TypedToolCall<TOOLS>> = [];

  // forward stream
  return stream.pipeThrough(
    new TransformStream<
      LanguageModelStreamPart<TOOLS>,
      ExecuteToolsStreamPart<TOOLS>
    >({
      async transform(
        chunk: LanguageModelStreamPart<TOOLS>,
        controller: TransformStreamDefaultController<
          ExecuteToolsStreamPart<TOOLS>
        >,
      ) {
        // immediately forward all chunks
        controller.enqueue(chunk);

        const chunkType = chunk.type;

        switch (chunkType) {
          case 'tool-call': {
            if (chunk.invalid) {
              return;
            }

            const tool = getOwn(tools, chunk.toolName);

            if (tool == null) {
              // ignore tool calls for tools that are not available,
              // e.g. provider-executed dynamic tools
              return;
            }

            const toolApprovalStatus = await resolveToolApproval({
              tools,
              toolCall: chunk,
              toolApproval,
              messages,
              toolsContext,
              runtimeContext,
            });

            // Tools that don't require approval ('not-applicable') must not
            // consume an approval id, so that id generation stays stable for
            // callers that rely on deterministic id sequences. They execute
            // directly (when not provider-executed).
            if (toolApprovalStatus.type === 'not-applicable') {
              if (tool.execute != null && chunk.providerExecuted !== true) {
                toolCallsToExecute.push(chunk);
              }

              return;
            }

            const approvalId = generateId();
            const signature = await maybeSignApproval({
              secret: toolApprovalSecret,
              approvalId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              input: chunk.input,
            });

            switch (toolApprovalStatus.type) {
              case 'user-approval': {
                controller.enqueue({
                  type: 'tool-approval-request',
                  approvalId,
                  toolCall: chunk,
                  ...(signature != null ? { signature } : {}),
                });

                return; // don't execute tool
              }

              case 'denied': {
                controller.enqueue({
                  type: 'tool-approval-request',
                  approvalId,
                  toolCall: chunk,
                  isAutomatic: true,
                  ...(signature != null ? { signature } : {}),
                });
                controller.enqueue({
                  type: 'tool-approval-response',
                  approvalId,
                  approved: false,
                  toolCall: chunk,
                  reason: toolApprovalStatus.reason,
                  providerExecuted: chunk.providerExecuted,
                });

                return; // don't execute tool
              }

              case 'approved': {
                controller.enqueue({
                  type: 'tool-approval-request',
                  approvalId,
                  toolCall: chunk,
                  isAutomatic: true,
                  ...(signature != null ? { signature } : {}),
                });
                controller.enqueue({
                  type: 'tool-approval-response',
                  approvalId,
                  approved: true,
                  toolCall: chunk,
                  reason: toolApprovalStatus.reason,
                  providerExecuted: chunk.providerExecuted,
                });

                break; // continue with tool execution
              }
            }

            // approved tool calls continue to execution (when not
            // provider-executed):
            if (tool.execute != null && chunk.providerExecuted !== true) {
              toolCallsToExecute.push(chunk);
            }

            return;
          }

          case 'model-call-end': {
            await Promise.all(
              toolCallsToExecute.map(async toolCall => {
                try {
                  // Note: we don't await the tool execution here (by leaving out 'await' on recordSpan),
                  // because we want to process the next chunk as soon as possible.
                  // This is important for the case where the tool execution takes a long time.
                  const result = await executeToolCall({
                    toolCall,
                    tools,
                    callId,
                    messages,
                    abortSignal,
                    timeout,
                    experimental_sandbox: sandbox,
                    toolsContext,
                    onToolExecutionStart,
                    onToolExecutionEnd,
                    executeToolInTelemetryContext,
                    runInTracingChannelSpan,
                    onPreliminaryToolResult: result => {
                      controller.enqueue(result);
                    },
                  });
                  if (result != null) {
                    controller.enqueue({
                      type: 'tool-execution-end',
                      toolCallId: result.output.toolCallId,
                      toolExecutionMs: result.toolExecutionMs,
                    });
                    controller.enqueue(result.output);
                  }
                } catch (error) {
                  controller.enqueue({
                    type: 'error',
                    error,
                  });
                }
              }),
            );

            return;
          }
        }
      },
    }),
  );
}
