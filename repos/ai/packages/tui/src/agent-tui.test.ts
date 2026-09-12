import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AgentTUIRunner,
  type AgentTUIRenderer,
  type AgentTUISessionOptions,
  type AgentTUIToolApprovalRequest,
  type AgentTUIToolApprovalResponse,
} from './agent-tui-runner';
import { runAgentTUI, type AgentTUIAgent } from './run-agent-tui';
import {
  readUIMessageStream,
  type Agent,
  type AgentStreamParameters,
  type ChatTransport,
  type Experimental_SandboxSession,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

let testRenderer: AgentTUIRenderer | undefined;
let terminalRendererOptions: unknown[] = [];

vi.mock('./tui/terminal-renderer', () => ({
  TerminalRenderer: vi.fn(function TerminalRenderer(options) {
    terminalRendererOptions.push(options);

    if (!testRenderer) {
      throw new Error('Expected a test renderer.');
    }

    return testRenderer;
  }),
}));

describe('runAgentTUI', () => {
  beforeEach(() => {
    testRenderer = undefined;
    terminalRendererOptions = [];
  });

  it('creates the default terminal renderer when none is provided', async () => {
    useRenderer(
      createRenderer({
        prompts: [undefined],
      }),
    );
    const agent = createAISDKAgent();

    await runAgentTUI({ agent, title: 'Test Agent' });

    expect(terminalRendererOptions).toEqual([undefined]);
  });

  it('passes display modes to the default terminal renderer', async () => {
    useRenderer(
      createRenderer({
        prompts: [undefined],
      }),
    );
    const agent = createAISDKAgent();

    await runAgentTUI({
      agent,
      title: 'Test Agent',
      tools: 'collapsed',
      reasoning: 'hidden',
    });

    expect(terminalRendererOptions).toEqual([
      { tools: 'collapsed', reasoning: 'hidden' },
    ]);
  });

  it('passes response statistics mode to the default terminal renderer', async () => {
    useRenderer(
      createRenderer({
        prompts: [undefined],
      }),
    );
    const agent = createAISDKAgent();

    await runAgentTUI({
      agent,
      title: 'Test Agent',
      responseStatistics: 'outputTokensPerSecond',
    });

    expect(terminalRendererOptions).toEqual([
      {
        responseStatistics: 'outputTokensPerSecond',
        reasoning: undefined,
        tools: undefined,
      },
    ]);
  });

  it('passes context size to the default terminal renderer', async () => {
    useRenderer(
      createRenderer({
        prompts: [undefined],
      }),
    );
    const agent = createAISDKAgent();

    await runAgentTUI({
      agent,
      title: 'Test Agent',
      contextSize: 200_000,
    });

    expect(terminalRendererOptions).toEqual([
      {
        responseStatistics: undefined,
        contextSize: 200_000,
        reasoning: undefined,
        tools: undefined,
      },
    ]);
  });
});

describe('AgentTUIRunner', () => {
  beforeEach(() => {
    testRenderer = undefined;
    terminalRendererOptions = [];
  });

  it('prompts before the first turn', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expectStreamCalls(streamCalls, [[createUserModelMessage('hello')]]);
    expect(renderer.submittedPrompts).toEqual(['hello']);
    expect(renderer.tools).toEqual(['auto-collapsed']);
    expect(renderer.reasoning).toEqual(['auto-collapsed']);
  });

  it('continues prompting and passes message history', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['first', 'second', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expectStreamCalls(streamCalls, [
      [createUserModelMessage('first')],
      [
        createUserModelMessage('first'),
        createAssistantModelMessage('response to first'),
        createUserModelMessage('second'),
      ],
    ]);
    expect(renderer.submittedPrompts).toEqual(['first', 'second']);
  });

  it('sends UI message history through a chat transport', async () => {
    const transportCalls: ChatTransportCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['first', 'second', undefined],
      }),
    );
    const transport = createChatTransport(transportCalls);

    await new AgentTUIRunner({ transport, title: 'Test Agent' }).run();

    expect(transportCalls).toHaveLength(2);
    expect(transportCalls[0]).toMatchObject({
      trigger: 'submit-message',
      messageId: undefined,
      messages: [createUserUIMessage('message-1', 'first')],
      abortSignal: expect.any(AbortSignal),
    });
    expect(transportCalls[1]).toMatchObject({
      trigger: 'submit-message',
      messageId: undefined,
      messages: [
        createUserUIMessage('message-1', 'first'),
        createAssistantUIMessage('response-1', 'response to first'),
        createUserUIMessage('message-2', 'second'),
      ],
      abortSignal: expect.any(AbortSignal),
    });
    expect(transportCalls[0]?.chatId).toEqual(expect.any(String));
    expect(transportCalls[1]?.chatId).toBe(transportCalls[0]?.chatId);
    expect(renderer.submittedPrompts).toEqual(['first', 'second']);
  });

  it('collects assistant text after tool calls in a multi-step stream', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    useRenderer(
      createRenderer({
        prompts: ['weather', 'next', undefined],
      }),
    );
    const agent = createMultiStepAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expectStreamCalls(streamCalls, [
      [createUserModelMessage('weather')],
      [
        createUserModelMessage('weather'),
        createAssistantModelMessageWithToolInvocation(),
        createToolModelMessageWithToolInvocation(),
        createUserModelMessage('next'),
      ],
    ]);
  });

  it('continues the turn with a tool approval response', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['run command', undefined],
        toolApprovals: [{ approved: true }],
      }),
    );
    const agent = createApprovalAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expectStreamCalls(streamCalls, [
      [createUserModelMessage('run command')],
      [
        createUserModelMessage('run command'),
        createAssistantModelMessageWithToolApproval(),
        createToolModelMessageWithToolApproval(true),
      ],
    ]);
    expect(renderer.toolApprovalRequests).toEqual([
      expect.objectContaining({
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
        messageId: 'message-2',
        partIndex: 0,
      }),
    ]);
    expect(renderer.submittedPrompts).toEqual(['run command']);
  });

  it('exits when prompt input is interrupted', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    useRenderer({
      async readPrompt() {
        throw new Error('Interrupted');
      },
      async renderStream() {
        throw new Error('Expected no stream to render.');
      },
    });
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expect(streamCalls).toEqual([]);
  });

  it('uses the provided title as the session title', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expect(terminalRendererOptions).toEqual([undefined]);
    expect(renderer.submittedPrompts).toEqual(['hello']);
    expect(renderer.titles).toEqual(['Test Agent', 'Test Agent', 'Test Agent']);
  });

  it('omits the session title by default', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent }).run();

    expect(renderer.submittedPrompts).toEqual(['hello']);
    expect(renderer.titles).toEqual([undefined, undefined, undefined]);
  });

  it('defaults response statistics mode to output tokens per second', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expect(renderer.responseStatistics).toEqual(['outputTokensPerSecond']);
  });

  it('passes response statistics mode to stream rendering', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({
      agent,
      title: 'Test Agent',
      responseStatistics: 'outputTokenCount',
    }).run();

    expect(renderer.responseStatistics).toEqual(['outputTokenCount']);
  });

  it('passes context size to stream rendering', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({
      agent,
      title: 'Test Agent',
      contextSize: 200_000,
    }).run();

    expect(renderer.contextSizes).toEqual([200_000]);
  });

  it('passes the sandbox to every agent stream call', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    useRenderer(
      createRenderer({
        prompts: ['first', 'second', undefined],
      }),
    );
    const agent = createAgent(streamCalls);
    const sandbox = createSandboxSession();

    await new AgentTUIRunner({ agent, title: 'Test Agent', sandbox }).run();

    expect(streamCalls).toHaveLength(2);
    expect(streamCalls.map(call => call.experimental_sandbox)).toEqual([
      sandbox,
      sandbox,
    ]);
  });

  it('streams total token usage in response metadata', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = useRenderer(
      createRenderer({
        prompts: ['hello', undefined],
      }),
    );
    const agent = createAgent(streamCalls, [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', text: 'hello' },
      { type: 'text-end', id: 'text-1' },
      {
        type: 'finish',
        finishReason: 'stop',
        rawFinishReason: 'stop',
        totalUsage: createUsage({
          inputTokens: 3,
          outputTokens: 12,
          totalTokens: 15,
        }),
      },
    ]);

    await new AgentTUIRunner({ agent, title: 'Test Agent' }).run();

    expect(renderer.responseMessages[0]?.metadata).toEqual({
      usage: { totalTokens: 15, outputTokens: 12 },
    });
  });

  it('accepts an injected renderer', async () => {
    const streamCalls: AgentTUIStreamCall[] = [];
    const renderer = createRenderer({
      prompts: ['hello', undefined],
    });
    const agent = createAgent(streamCalls);

    await new AgentTUIRunner({ agent, title: 'Test Agent', renderer }).run();

    expectStreamCalls(streamCalls, [[createUserModelMessage('hello')]]);
    expect(terminalRendererOptions).toEqual([]);
    expect(renderer.submittedPrompts).toEqual(['hello']);
  });
});

type AgentTUIStreamCall = AgentStreamParameters<never, any, any>;
type ChatTransportCall = Parameters<
  ChatTransport<UIMessage>['sendMessages']
>[0];

function createChatTransport(
  calls: ChatTransportCall[],
): ChatTransport<UIMessage> {
  return {
    async sendMessages(options) {
      calls.push(options);

      const responseNumber = calls.length;
      return createUIMessageChunkStream(
        `response-${responseNumber}`,
        `response to ${lastUserUIMessageText(options.messages)}`,
      );
    },
    async reconnectToStream() {
      return null;
    },
  };
}

function createAgent(
  streamCalls: AgentTUIStreamCall[],
  fullStreamParts?: TextStreamPart<ToolSet>[],
): AgentTUIAgent {
  return {
    version: 'agent-v1',
    id: undefined,
    tools: {},
    generate() {
      throw new Error('Expected no generate call.');
    },
    stream(options: AgentTUIStreamCall) {
      streamCalls.push(options);

      return {
        fullStream:
          fullStreamParts ??
          createStream(`response to ${lastUserMessageText(options)}`),
      } as any;
    },
  };
}

function createMultiStepAgent(
  streamCalls: AgentTUIStreamCall[],
): AgentTUIAgent {
  return {
    version: 'agent-v1',
    id: undefined,
    tools: {},
    generate() {
      throw new Error('Expected no generate call.');
    },
    stream(options: AgentTUIStreamCall) {
      streamCalls.push(options);

      return {
        fullStream: createMultiStepStream(),
      } as any;
    },
  };
}

function createApprovalAgent(streamCalls: AgentTUIStreamCall[]): AgentTUIAgent {
  return {
    version: 'agent-v1',
    id: undefined,
    tools: {},
    generate() {
      throw new Error('Expected no generate call.');
    },
    stream(options: AgentTUIStreamCall) {
      streamCalls.push(options);

      return {
        fullStream:
          streamCalls.length === 1
            ? createApprovalRequestStream()
            : createApprovalResponseStream(),
      } as any;
    },
  };
}

function createAISDKAgent(): Agent<any, any, any, any> {
  return { version: 'agent-v1' } as Agent<any, any, any, any>;
}

function createSandboxSession(): Experimental_SandboxSession {
  return {
    description: 'test sandbox',
    readFile: async () => null,
    readBinaryFile: async () => null,
    readTextFile: async () => null,
    writeFile: async () => {},
    writeBinaryFile: async () => {},
    writeTextFile: async () => {},
    spawn: async () => ({
      stdout: new ReadableStream<Uint8Array>(),
      stderr: new ReadableStream<Uint8Array>(),
      wait: async () => ({ exitCode: 0 }),
      kill: async () => {},
    }),
    run: async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }),
  };
}

type TestRenderer = AgentTUIRenderer & {
  submittedPrompts: string[];
  titles: Array<AgentTUISessionOptions['title']>;
  responseStatistics: Array<AgentTUISessionOptions['responseStatistics']>;
  tools: Array<AgentTUISessionOptions['tools']>;
  reasoning: Array<AgentTUISessionOptions['reasoning']>;
  contextSizes: Array<AgentTUISessionOptions['contextSize']>;
  toolApprovalRequests: AgentTUIToolApprovalRequest[];
  responseMessages: UIMessage[];
};

function useRenderer<TRenderer extends AgentTUIRenderer>(
  renderer: TRenderer,
): TRenderer {
  testRenderer = renderer;

  return renderer;
}

function expectStreamCalls(
  calls: AgentTUIStreamCall[],
  prompts: ModelMessage[][],
) {
  expect(calls).toHaveLength(prompts.length);

  for (const [index, prompt] of prompts.entries()) {
    expect(calls[index]?.prompt).toEqual(prompt);
    expect(calls[index]?.abortSignal).toBeInstanceOf(AbortSignal);
  }
}

function createRenderer(options: {
  prompts: Array<string | undefined>;
  toolApprovals?: AgentTUIToolApprovalResponse[];
}): TestRenderer {
  const submittedPrompts: string[] = [];
  const titles: Array<AgentTUISessionOptions['title']> = [];
  const responseStatistics: Array<
    AgentTUISessionOptions['responseStatistics']
  > = [];
  const tools: Array<AgentTUISessionOptions['tools']> = [];
  const reasoning: Array<AgentTUISessionOptions['reasoning']> = [];
  const contextSizes: Array<AgentTUISessionOptions['contextSize']> = [];
  const toolApprovalRequests: AgentTUIToolApprovalRequest[] = [];
  const responseMessages: UIMessage[] = [];

  return {
    submittedPrompts,
    titles,
    responseStatistics,
    tools,
    reasoning,
    contextSizes,
    toolApprovalRequests,
    responseMessages,
    async readPrompt(sessionOptions) {
      titles.push(sessionOptions?.title);

      return options.prompts.shift();
    },
    async readToolApproval(request, sessionOptions) {
      titles.push(sessionOptions?.title);

      toolApprovalRequests.push(request);

      const approval = options.toolApprovals?.shift();
      if (!approval) {
        throw new Error('Expected a test tool approval.');
      }

      return approval;
    },
    async renderStream(result, sessionOptions) {
      titles.push(sessionOptions?.title);

      if (sessionOptions?.submittedPrompt) {
        submittedPrompts.push(sessionOptions.submittedPrompt);
      }

      responseStatistics.push(sessionOptions?.responseStatistics);
      tools.push(sessionOptions?.tools);
      reasoning.push(sessionOptions?.reasoning);
      contextSizes.push(sessionOptions?.contextSize);

      let responseMessage: UIMessage | undefined;

      for await (const message of readUIMessageStream({
        stream: toReadableStream(result.uiMessageStream),
      })) {
        responseMessage = message;
      }

      if (responseMessage) {
        responseMessages.push(responseMessage);
      }

      return responseMessage;
    },
  };
}

function createStream(text: string): AsyncIterable<TextStreamPart<ToolSet>> {
  return (async function* () {
    yield { type: 'text-delta', id: 'text-1', text };
  })();
}

function createUsage({
  inputTokens,
  outputTokens,
  totalTokens,
}: {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}) {
  return {
    inputTokens,
    inputTokenDetails: {
      noCacheTokens: inputTokens,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokens,
    outputTokenDetails: {
      textTokens: outputTokens,
      reasoningTokens: undefined,
    },
    totalTokens,
  };
}

function lastUserMessageText(options: AgentTUIStreamCall) {
  const prompt = options.prompt as ModelMessage[];

  let message: ModelMessage | undefined;
  for (let index = prompt.length - 1; index >= 0; index--) {
    if (prompt[index]?.role === 'user') {
      message = prompt[index];
      break;
    }
  }

  if (!message) {
    throw new Error('Expected at least one user message.');
  }

  return modelMessageText(message);
}

function modelMessageText(message: ModelMessage) {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');
}

function createUserModelMessage(text: string): ModelMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
  };
}

function createUserUIMessage(id: string, text: string): UIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function createAssistantUIMessage(id: string, text: string): UIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text }] };
}

function lastUserUIMessageText(messages: UIMessage[]) {
  let message: UIMessage | undefined;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') {
      message = messages[index];
      break;
    }
  }
  const part = message?.parts.find(part => part.type === 'text');

  if (!part || part.type !== 'text') {
    throw new Error('Expected at least one user text message.');
  }

  return part.text;
}

function createUIMessageChunkStream(
  messageId: string,
  text: string,
): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'start', messageId });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish' });
      controller.close();
    },
  });
}

function createAssistantModelMessage(text: string): ModelMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
  };
}

function createAssistantModelMessageWithToolInvocation(): ModelMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'weather',
        input: { city: 'Berlin' },
        providerExecuted: undefined,
      },
      { type: 'text', text: 'Berlin is snowy and 72F.' },
    ],
  };
}

function createToolModelMessageWithToolInvocation(): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'weather',
        output: {
          type: 'json',
          value: { city: 'Berlin', temperature: 72, weather: 'snowy' },
        },
      },
    ],
  };
}

function createAssistantModelMessageWithToolApproval(): ModelMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
        providerExecuted: undefined,
      },
      {
        type: 'tool-approval-request',
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        isAutomatic: undefined,
      },
    ],
  };
}

function createToolModelMessageWithToolApproval(
  approved: boolean,
): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-approval-response',
        approvalId: 'approval-1',
        approved,
        reason: undefined,
        providerExecuted: undefined,
      },
    ],
  };
}

function toReadableStream(
  stream: AsyncIterable<UIMessageChunk> | ReadableStream<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
  if (stream instanceof ReadableStream) {
    return stream;
  }

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createMultiStepStream(): AsyncIterable<TextStreamPart<ToolSet>> {
  return (async function* () {
    yield {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'weather',
      input: { city: 'Berlin' },
    } as TextStreamPart<ToolSet>;
    yield {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'weather',
      input: { city: 'Berlin' },
      output: { city: 'Berlin', temperature: 72, weather: 'snowy' },
    } as TextStreamPart<ToolSet>;
    yield {
      type: 'text-delta',
      id: 'text-1',
      text: 'Berlin is snowy and 72F.',
    };
  })();
}

function createApprovalRequestStream(): AsyncIterable<TextStreamPart<ToolSet>> {
  return (async function* () {
    yield {
      type: 'tool-approval-request',
      approvalId: 'approval-1',
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
      },
    } as TextStreamPart<ToolSet>;
  })();
}

function createApprovalResponseStream(): AsyncIterable<
  TextStreamPart<ToolSet>
> {
  return (async function* () {
    yield {
      type: 'tool-approval-response',
      approvalId: 'approval-1',
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'shell',
        input: { command: 'date' },
      },
      approved: true,
    } as TextStreamPart<ToolSet>;
    yield {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'shell',
      input: { command: 'date' },
      output: 'ok',
    } as TextStreamPart<ToolSet>;
    yield { type: 'text-delta', id: 'text-1', text: 'command approved' };
  })();
}
