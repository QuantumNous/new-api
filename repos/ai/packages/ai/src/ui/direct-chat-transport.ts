import type { Context, Tool, ToolSet } from '@ai-sdk/provider-utils';
import type { Agent } from '../agent/agent';
import type { Output } from '../generate-text/output';
import type { UIMessageStreamOptions } from '../generate-text/stream-text-result';
import { toUIMessageStream } from '../ui-message-stream/to-ui-message-stream';
import type { UIMessageChunk } from '../ui-message-stream/ui-message-chunks';
import type { ChatTransport } from './chat-transport';
import { convertToModelMessages } from './convert-to-model-messages';
import type {
  InferUIMessageTools,
  InferUITools,
  UIMessage,
} from './ui-messages';
import { validateUIMessages } from './validate-ui-messages';

/**
 * Options for the `DirectChatTransport` class.
 */
export type DirectChatTransportOptions<
  CALL_OPTIONS,
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends Output,
  UI_MESSAGE extends UIMessage<unknown, never, InferUITools<TOOLS>>,
> = {
  /**
   * The agent to use for generating responses.
   */
  agent: Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>;

  /**
   * Options to pass to the agent when calling it.
   */
  options?: CALL_OPTIONS;
} & Omit<UIMessageStreamOptions<UI_MESSAGE>, 'onFinish'>;

/**
 * A transport that directly communicates with an Agent in-process,
 * without going through HTTP. This is useful for:
 * - Server-side rendering scenarios
 * - Testing without network
 * - Single-process applications
 *
 * @example
 * ```tsx
 * import { useChat } from '@ai-sdk/react';
 * import { DirectChatTransport } from 'ai';
 * import { myAgent } from './my-agent';
 *
 * const { messages, sendMessage } = useChat({
 *   transport: new DirectChatTransport({ agent: myAgent }),
 * });
 * ```
 */
export class DirectChatTransport<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = {},
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = never,
  UI_MESSAGE extends UIMessage<unknown, never, InferUITools<TOOLS>> = UIMessage<
    unknown,
    never,
    InferUITools<TOOLS>
  >,
> implements ChatTransport<UI_MESSAGE> {
  private readonly agent: Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>;
  private readonly agentOptions: CALL_OPTIONS | undefined;
  private readonly uiMessageStreamOptions: Omit<
    UIMessageStreamOptions<UI_MESSAGE>,
    'onFinish'
  >;

  constructor({
    agent,
    options,
    ...uiMessageStreamOptions
  }: DirectChatTransportOptions<
    CALL_OPTIONS,
    TOOLS,
    RUNTIME_CONTEXT,
    OUTPUT,
    UI_MESSAGE
  >) {
    this.agent = agent;
    this.agentOptions = options;
    this.uiMessageStreamOptions = uiMessageStreamOptions;
  }

  async sendMessages({
    messages,
    abortSignal,
  }: Parameters<ChatTransport<UI_MESSAGE>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    // Validate the incoming UI messages
    const validatedMessages = await validateUIMessages<UI_MESSAGE>({
      messages,
      // tools are compatible; the casting is required because the context param is
      // not available in ui messages
      tools: this.agent.tools as unknown as {
        [NAME in keyof InferUIMessageTools<UI_MESSAGE> & string]?: Tool<
          InferUIMessageTools<UI_MESSAGE>[NAME]['input'],
          InferUIMessageTools<UI_MESSAGE>[NAME]['output']
        >;
      },
    });

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(validatedMessages, {
      tools: this.agent.tools,
    });

    // Stream from the agent
    const result = await this.agent.stream({
      prompt: modelMessages,
      abortSignal,
      ...(this.agentOptions !== undefined
        ? { options: this.agentOptions }
        : {}),
    } as Parameters<
      Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>['stream']
    >[0]);

    // Return the UI message stream
    return toUIMessageStream({
      ...this.uiMessageStreamOptions,
      stream: result.stream,
      tools: this.agent.tools,
    });
  }

  /**
   * Direct transport does not support reconnection since there is no
   * persistent server-side stream to reconnect to.
   *
   * @returns Always returns `null`
   */
  async reconnectToStream(
    _options: Parameters<ChatTransport<UI_MESSAGE>['reconnectToStream']>[0],
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
