import type {
  AgentTUIAgent,
  ResponseStatisticsMode,
  RunAgentTUIOptions,
  TerminalPartDisplayMode,
} from './run-agent-tui';
import {
  TerminalRenderer,
  type TerminalInput,
  type TerminalOutput,
} from './tui/terminal-renderer';
import {
  convertToModelMessages,
  generateId,
  getToolName,
  isToolUIPart,
  type ChatTransport,
  type StepResultPerformance,
  type Experimental_SandboxSession,
  type LanguageModelUsage,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

const defaultResponseStatistics: ResponseStatisticsMode =
  'outputTokensPerSecond';

export type AgentTUIStreamResult = {
  uiMessageStream:
    | AsyncIterable<UIMessageChunk>
    | ReadableStream<UIMessageChunk>;
  message?: UIMessage;
  abort?: () => void;
};

export type AgentTUIStreamOptions = {
  messages: UIMessage[];
};

export type AgentTUISessionOptions = {
  title?: string;
  initialPrompt?: string;
  submittedPrompt?: string;
  waitForExit?: boolean;
  continueSession?: boolean;
  tools?: TerminalPartDisplayMode;
  reasoning?: TerminalPartDisplayMode;
  responseStatistics?: ResponseStatisticsMode;
  contextSize?: number;
};

export type AgentTUIToolApprovalRequest = {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  title?: string;
  input: unknown;
  providerExecuted?: boolean;
  messageId: string;
  partIndex: number;
};

export type AgentTUIToolApprovalResponse = {
  approved: boolean;
  reason?: string;
};

export type AgentTUIRenderer = {
  readPrompt?(options?: AgentTUISessionOptions): Promise<string | undefined>;
  readToolApproval?(
    request: AgentTUIToolApprovalRequest,
    options?: AgentTUISessionOptions,
  ): Promise<AgentTUIToolApprovalResponse>;
  renderStream(
    result: AgentTUIStreamResult,
    options?: AgentTUISessionOptions,
  ): Promise<UIMessage | undefined>;
};

export type AgentTUIRunnerOptions = RunAgentTUIOptions & {
  renderer?: AgentTUIRenderer;
  screen?: TerminalOutput;
  userInput?: TerminalInput;
};

export class AgentTUIRunner {
  private readonly agent?: AgentTUIAgent;
  private readonly transport?: ChatTransport<UIMessage>;
  private readonly chatId = generateId();
  private readonly renderer: AgentTUIRenderer;
  private readonly title?: string;
  private readonly tools: TerminalPartDisplayMode;
  private readonly reasoning: TerminalPartDisplayMode;
  private readonly responseStatistics: ResponseStatisticsMode;
  private readonly contextSize?: number;
  private readonly sandbox?: Experimental_SandboxSession;

  constructor(options: AgentTUIRunnerOptions) {
    this.agent = options.agent;
    this.transport = options.transport;
    this.renderer = createRenderer(options) ?? createDefaultRenderer(options);
    this.title = options.title;
    this.tools = options.tools ?? 'auto-collapsed';
    this.reasoning = options.reasoning ?? 'auto-collapsed';
    this.responseStatistics =
      options.responseStatistics ?? defaultResponseStatistics;
    this.contextSize = options.contextSize;
    this.sandbox = options.sandbox;
  }

  async run() {
    const title = this.title;
    const messages: UIMessage[] = [];
    let nextMessageIndex = 0;
    const generateMessageId = () => `message-${++nextMessageIndex}`;
    let prompt: string | undefined;
    let hasRunTurn = false;
    let streamWithoutPrompt = false;

    while (true) {
      if (!streamWithoutPrompt) {
        if (prompt == null) {
          if (!this.renderer.readPrompt) {
            if (hasRunTurn) {
              return;
            }

            throw new Error(
              'No prompt was provided and the renderer does not support prompt input.',
            );
          }

          try {
            prompt = await this.renderer.readPrompt({ title });
          } catch (error) {
            if (isInterruptedError(error)) {
              return;
            }

            throw error;
          }

          if (prompt == null) {
            return;
          }
        }

        messages.push(createUserMessage(generateMessageId(), prompt));
        hasRunTurn = true;
      }

      const result = await this.streamMessages(
        [...messages],
        generateMessageId,
      );

      try {
        const responseMessage = await this.renderer.renderStream(result, {
          title,
          submittedPrompt: prompt,
          continueSession: Boolean(this.renderer.readPrompt),
          tools: this.tools,
          reasoning: this.reasoning,
          responseStatistics: this.responseStatistics,
          contextSize: this.contextSize,
          waitForExit: false,
        });

        if (responseMessage && responseMessage.parts.length > 0) {
          const approvalRequests =
            findPendingToolApprovalRequests(responseMessage);

          if (approvalRequests.length > 0) {
            if (!this.renderer.readToolApproval) {
              throw new Error(
                'Tool approval was requested, but the renderer does not support tool approval input.',
              );
            }

            for (const request of approvalRequests) {
              const response = await this.renderer.readToolApproval(request, {
                title,
              });
              applyToolApprovalResponse(responseMessage, request, response);
            }

            upsertResponseMessage(
              messages,
              responseMessage,
              streamWithoutPrompt,
            );
            streamWithoutPrompt = true;
            prompt = undefined;
            continue;
          }

          upsertResponseMessage(messages, responseMessage, streamWithoutPrompt);
        }
      } catch (error) {
        if (isInterruptedError(error)) {
          return;
        }

        throw error;
      }
      streamWithoutPrompt = false;
      prompt = undefined;
    }
  }

  private async streamMessages(
    messages: UIMessage[],
    generateMessageId: () => string,
  ): Promise<AgentTUIStreamResult> {
    const abortController = new AbortController();
    const abort = () => abortController.abort();

    if (this.transport) {
      return {
        uiMessageStream: await this.transport.sendMessages({
          trigger: 'submit-message',
          chatId: this.chatId,
          messageId: undefined,
          messages,
          abortSignal: abortController.signal,
        }),
        message: lastAssistantMessage(messages),
        abort,
      };
    }

    const agent = this.agent!;
    const result = await agent.stream({
      prompt: await convertToModelMessages(messages, {
        tools: agent.tools as ToolSet,
      }),
      abortSignal: abortController.signal,
      options: undefined,
      experimental_sandbox: this.sandbox,
    });

    return {
      uiMessageStream: textStreamToUIMessageStream(
        result.fullStream as AsyncIterable<TextStreamPart<ToolSet>>,
        generateMessageId,
        messages,
      ),
      message: lastAssistantMessage(messages),
      abort,
    };
  }
}

function createDefaultRenderer(options: AgentTUIRunnerOptions) {
  return options.tools === undefined &&
    options.reasoning === undefined &&
    options.responseStatistics === undefined &&
    options.contextSize === undefined
    ? new TerminalRenderer()
    : new TerminalRenderer({
        tools: options.tools,
        reasoning: options.reasoning,
        responseStatistics: options.responseStatistics,
        contextSize: options.contextSize,
      });
}

function createRenderer(
  options: AgentTUIRunnerOptions,
): AgentTUIRenderer | undefined {
  if (options.renderer) {
    return options.renderer;
  }

  if (!options.screen && !options.userInput) {
    return undefined;
  }

  return new TerminalRenderer({
    tools: options.tools,
    reasoning: options.reasoning,
    responseStatistics: options.responseStatistics,
    contextSize: options.contextSize,
    input: options.userInput,
    output: options.screen,
  });
}

async function* textStreamToUIMessageStream(
  stream: AsyncIterable<TextStreamPart<ToolSet>>,
  generateMessageId: () => string,
  originalMessages: UIMessage[] = [],
): AsyncIterable<UIMessageChunk> {
  const openTextParts = new Set<string>();
  const openReasoningParts = new Set<string>();
  const openToolCalls = new Set<string>();
  let latestStepUsage: LanguageModelUsage | undefined;
  let latestPerformance: StepResultPerformance | undefined;
  let sentFinish = false;

  yield {
    type: 'start',
    messageId:
      lastAssistantMessage(originalMessages)?.id ?? generateMessageId(),
  };

  for await (const part of stream) {
    switch (part.type) {
      case 'text-start':
        openTextParts.add(part.id);
        yield {
          type: 'text-start',
          id: part.id,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'text-delta':
        if (!openTextParts.has(part.id)) {
          openTextParts.add(part.id);
          yield {
            type: 'text-start',
            id: part.id,
            providerMetadata: part.providerMetadata,
          };
        }
        yield {
          type: 'text-delta',
          id: part.id,
          delta: part.text,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'text-end':
        openTextParts.delete(part.id);
        yield {
          type: 'text-end',
          id: part.id,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'reasoning-start':
        openReasoningParts.add(part.id);
        yield {
          type: 'reasoning-start',
          id: part.id,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'reasoning-delta':
        if (!openReasoningParts.has(part.id)) {
          openReasoningParts.add(part.id);
          yield {
            type: 'reasoning-start',
            id: part.id,
            providerMetadata: part.providerMetadata,
          };
        }
        yield {
          type: 'reasoning-delta',
          id: part.id,
          delta: part.text,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'reasoning-end':
        openReasoningParts.delete(part.id);
        yield {
          type: 'reasoning-end',
          id: part.id,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'tool-input-start':
        yield {
          type: 'tool-input-start',
          toolCallId: part.id,
          toolName: part.toolName,
          providerExecuted: part.providerExecuted,
          providerMetadata: part.providerMetadata,
          toolMetadata: part.toolMetadata,
          dynamic: part.dynamic,
          title: part.title,
        };
        break;
      case 'tool-input-delta':
        yield {
          type: 'tool-input-delta',
          toolCallId: part.id,
          inputTextDelta: part.delta,
        };
        break;
      case 'tool-call':
        openToolCalls.add(part.toolCallId);
        yield {
          type: 'tool-input-available',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          providerExecuted: part.providerExecuted,
          providerMetadata: part.providerMetadata,
          toolMetadata: part.toolMetadata,
          dynamic: part.dynamic,
          title: part.title,
        };
        break;
      case 'tool-approval-request':
        if (!openToolCalls.has(part.toolCall.toolCallId)) {
          openToolCalls.add(part.toolCall.toolCallId);
          yield {
            type: 'tool-input-available',
            toolCallId: part.toolCall.toolCallId,
            toolName: part.toolCall.toolName,
            input: part.toolCall.input,
            providerExecuted: part.toolCall.providerExecuted,
            providerMetadata: part.toolCall.providerMetadata,
            toolMetadata: part.toolCall.toolMetadata,
            dynamic: part.toolCall.dynamic,
            title: part.toolCall.title,
          };
        }
        yield {
          type: 'tool-approval-request',
          approvalId: part.approvalId,
          toolCallId: part.toolCall.toolCallId,
          isAutomatic: part.isAutomatic,
        };
        break;
      case 'tool-approval-response':
        yield {
          type: 'tool-approval-response',
          approvalId: part.approvalId,
          approved: part.approved,
          reason: part.reason,
          providerExecuted: part.providerExecuted,
        };
        break;
      case 'tool-result':
        yield {
          type: 'tool-output-available',
          toolCallId: part.toolCallId,
          output: part.output,
          providerExecuted: part.providerExecuted,
          providerMetadata: part.providerMetadata,
          toolMetadata: part.toolMetadata,
          dynamic: part.dynamic,
          preliminary: part.preliminary,
        };
        break;
      case 'tool-error':
        yield {
          type: 'tool-output-error',
          toolCallId: part.toolCallId,
          errorText: formatStreamError(part.error),
          providerExecuted: part.providerExecuted,
          providerMetadata: part.providerMetadata,
          toolMetadata: part.toolMetadata,
          dynamic: part.dynamic,
        };
        break;
      case 'tool-output-denied':
        yield { type: 'tool-output-denied', toolCallId: part.toolCallId };
        break;
      case 'source':
        if (part.sourceType === 'url') {
          yield {
            type: 'source-url',
            sourceId: part.id,
            url: part.url,
            title: part.title,
            providerMetadata: part.providerMetadata,
          };
        } else {
          yield {
            type: 'source-document',
            sourceId: part.id,
            mediaType: part.mediaType,
            title: part.title,
            filename: part.filename,
            providerMetadata: part.providerMetadata,
          };
        }
        break;
      case 'file':
        yield {
          type: 'file',
          url: fileToDataUrl(part.file.mediaType, part.file.base64),
          mediaType: part.file.mediaType,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'reasoning-file':
        yield {
          type: 'reasoning-file',
          url: fileToDataUrl(part.file.mediaType, part.file.base64),
          mediaType: part.file.mediaType,
          providerMetadata: part.providerMetadata,
        };
        break;
      case 'start-step':
        yield { type: 'start-step' };
        break;
      case 'finish-step':
        latestStepUsage = part.usage;
        latestPerformance = part.performance;
        yield { type: 'finish-step' };
        break;
      case 'finish':
        yield* closeOpenParts(openTextParts, openReasoningParts);
        sentFinish = true;
        yield {
          type: 'finish',
          finishReason: part.finishReason,
          messageMetadata: createResponseMetadata(
            latestStepUsage ?? part.totalUsage,
            latestPerformance,
          ),
        };
        break;
      case 'abort':
        yield { type: 'abort', reason: part.reason };
        break;
      case 'error':
        yield { type: 'error', errorText: formatStreamError(part.error) };
        break;
    }
  }

  if (!sentFinish) {
    yield* closeOpenParts(openTextParts, openReasoningParts);
    yield { type: 'finish' };
  }
}

function createResponseMetadata(
  usage: LanguageModelUsage | undefined,
  performance?: StepResultPerformance,
): ResponseMetadata | undefined {
  if (
    usage?.totalTokens == null &&
    usage?.outputTokens == null &&
    performance?.outputTokensPerSecond == null
  ) {
    return undefined;
  }

  return {
    ...(usage?.totalTokens == null && usage?.outputTokens == null
      ? {}
      : {
          usage: {
            ...(usage.totalTokens == null
              ? {}
              : { totalTokens: usage.totalTokens }),
            ...(usage.outputTokens == null
              ? {}
              : { outputTokens: usage.outputTokens }),
          },
        }),
    ...(performance?.outputTokensPerSecond == null
      ? {}
      : {
          performance: {
            outputTokensPerSecond: performance.outputTokensPerSecond,
          },
        }),
  };
}

type ResponseMetadata = {
  usage?: {
    totalTokens?: number;
    outputTokens?: number;
  };
  performance?: Pick<StepResultPerformance, 'outputTokensPerSecond'>;
};

function* closeOpenParts(
  textPartIds: Set<string>,
  reasoningPartIds: Set<string>,
) {
  for (const id of textPartIds) {
    yield { type: 'text-end', id } satisfies UIMessageChunk;
  }
  textPartIds.clear();

  for (const id of reasoningPartIds) {
    yield { type: 'reasoning-end', id } satisfies UIMessageChunk;
  }
  reasoningPartIds.clear();
}

function createUserMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

function upsertResponseMessage(
  messages: UIMessage[],
  responseMessage: UIMessage,
  replaceLast: boolean,
) {
  if (replaceLast && messages.at(-1)?.role === 'assistant') {
    messages[messages.length - 1] = responseMessage;
    return;
  }

  messages.push(responseMessage);
}

function lastAssistantMessage(messages: UIMessage[]) {
  const message = messages.at(-1);

  return message?.role === 'assistant' ? message : undefined;
}

function findPendingToolApprovalRequests(
  message: UIMessage,
): AgentTUIToolApprovalRequest[] {
  const requests: AgentTUIToolApprovalRequest[] = [];

  for (const [index, part] of message.parts.entries()) {
    if (
      !isToolUIPart(part) ||
      part.state !== 'approval-requested' ||
      part.approval.isAutomatic === true
    ) {
      continue;
    }

    requests.push({
      approvalId: part.approval.id,
      toolCallId: part.toolCallId,
      toolName: getToolName(part),
      title: part.title,
      input: part.input,
      providerExecuted: part.providerExecuted,
      messageId: message.id,
      partIndex: index,
    });
  }

  return requests;
}

function applyToolApprovalResponse(
  message: UIMessage,
  request: AgentTUIToolApprovalRequest,
  response: AgentTUIToolApprovalResponse,
) {
  const part = message.parts[request.partIndex];

  if (!part || !isToolUIPart(part) || part.toolCallId !== request.toolCallId) {
    throw new Error(
      `Could not find tool approval request ${request.approvalId}.`,
    );
  }

  part.state = 'approval-responded';
  part.approval = {
    id: request.approvalId,
    approved: response.approved,
    ...(response.reason ? { reason: response.reason } : {}),
  };
}

function formatStreamError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

function fileToDataUrl(mediaType: string, base64: string) {
  return `data:${mediaType};base64,${base64}`;
}

function isInterruptedError(error: unknown) {
  return error instanceof Error && error.message === 'Interrupted';
}
