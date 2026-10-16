import {
  tool,
  type Experimental_SandboxSession,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import type { TextStreamPart } from 'ai';
import { describe, expect, test } from 'vitest';
import { z } from 'zod/v4';
import type {
  HarnessV1,
  HarnessV1PromptControl,
  HarnessV1PromptTurnOptions,
  HarnessV1Session,
  HarnessV1StreamPart,
} from '../../v1';
import { runPrompt } from './run-prompt';

const WORK_DIR = '/vercel/sandbox/claude-code-abc123';
const sandboxSession = {} as Experimental_SandboxSession;

function fakeSession(
  script: HarnessV1StreamPart[],
  onSubmitToolResult?: (input: {
    toolCallId: string;
    output: unknown;
    isError?: boolean;
  }) => void,
): HarnessV1Session {
  const emitScript = (emit: (event: HarnessV1StreamPart) => void) => {
    const control: HarnessV1PromptControl = {
      submitToolResult: async input => {
        onSubmitToolResult?.(input);
      },
      done: Promise.resolve(),
    };
    queueMicrotask(() => {
      for (const event of script) emit(event);
    });
    return control;
  };
  return {
    sessionId: 'fake-session',
    isResume: false,
    doPromptTurn: async (opts: HarnessV1PromptTurnOptions) =>
      emitScript(opts.emit),
    doContinueTurn: async opts => emitScript(opts.emit),
    doCompact: async () => {},
    doDetach: async () => ({
      type: 'resume-session',
      harnessId: 'fake',
      specificationVersion: 'harness-v1',
      data: {},
    }),
    doStop: async () => ({
      type: 'resume-session',
      harnessId: 'fake',
      specificationVersion: 'harness-v1',
      data: {},
    }),
    doDestroy: async () => {},
    doSuspendTurn: async () => ({
      type: 'continue-turn',
      harnessId: 'fake',
      specificationVersion: 'harness-v1',
      data: {},
    }),
  };
}

const harness: HarnessV1 = {
  specificationVersion: 'harness-v1',
  harnessId: 'fake',
  builtinTools: {},
  doStart: async () => fakeSession([]),
};

const finishEvents: HarnessV1StreamPart[] = [
  {
    type: 'finish-step',
    finishReason: { unified: 'stop', raw: 'end_turn' },
    usage: {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: undefined, text: undefined, reasoning: undefined },
    },
  },
  {
    type: 'finish',
    finishReason: { unified: 'stop', raw: 'end_turn' },
    totalUsage: {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: undefined, text: undefined, reasoning: undefined },
    },
  },
];

describe('runPrompt workDir stripping', () => {
  test('strips the workDir for consumers but executes host tools with the absolute path', async () => {
    const executedArgs: unknown[] = [];
    const readFile = tool({
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      execute: async (args: { path: string }) => {
        executedArgs.push(args);
        return { ok: true };
      },
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession([
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'readFile',
          input: JSON.stringify({ path: `${WORK_DIR}/src/foo.ts` }),
        },
        {
          type: 'tool-result',
          toolCallId: 'b1',
          toolName: 'bash',
          result: `${WORK_DIR}/src/foo.ts\n${WORK_DIR}/src/bar.ts\n`,
        },
        ...finishEvents,
      ]),
      prompt: 'go',
      instructions: undefined,
      tools: { readFile } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    // Host tool executes with the original absolute path so it resolves
    // against the sandbox root.
    expect(executedArgs).toEqual([{ path: `${WORK_DIR}/src/foo.ts` }]);

    // The consumer-facing tool-call has a workspace-relative path.
    const toolCall = parts.find(p => p.type === 'tool-call') as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-call' }
    >;
    expect(toolCall.input).toEqual({ path: 'src/foo.ts' });

    // The consumer-facing tool-result is stripped too.
    const toolResult = parts.find(p => p.type === 'tool-result') as Extract<
      TextStreamPart<ToolSet>,
      { type: 'tool-result' }
    >;
    expect(toolResult.output).toBe('src/foo.ts\nsrc/bar.ts\n');
  });
});

describe('runPrompt usage', () => {
  test('uses final total usage when it differs from received step usage', async () => {
    const { result, done } = runPrompt({
      harness,
      session: fakeSession([
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: {
              total: 2,
              noCache: 2,
              cacheRead: 0,
              cacheWrite: 0,
            },
            outputTokens: {
              total: 5,
              text: 5,
              reasoning: 0,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          totalUsage: {
            inputTokens: {
              total: 10,
              noCache: 4,
              cacheRead: 6,
              cacheWrite: 0,
            },
            outputTokens: {
              total: 40,
              text: 30,
              reasoning: 10,
            },
          },
        },
      ]),
      prompt: 'go',
      instructions: undefined,
      tools: {},
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
    });

    await done;
    await result.consumeStream();

    await expect(result.usage).resolves.toEqual({
      inputTokens: 10,
      inputTokenDetails: {
        noCacheTokens: 4,
        cacheReadTokens: 6,
        cacheWriteTokens: 0,
      },
      outputTokens: 40,
      outputTokenDetails: {
        textTokens: 30,
        reasoningTokens: 10,
      },
      totalTokens: 50,
      raw: undefined,
    });
  });
});

type SubmittedResult = {
  toolCallId: string;
  output: unknown;
  isError?: boolean;
};

function toolResultParts(
  parts: TextStreamPart<ToolSet>[],
): Extract<TextStreamPart<ToolSet>, { type: 'tool-result' }>[] {
  return parts.filter(p => p.type === 'tool-result') as Extract<
    TextStreamPart<ToolSet>,
    { type: 'tool-result' }
  >[];
}

describe('runPrompt host tool generator results', () => {
  test('pauses custom tool execution when approval is required', async () => {
    const submitted: SubmittedResult[] = [];
    const pending: unknown[] = [];
    const weather = tool({
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ temperature: 72 }),
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession(
        [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'weather',
            input: JSON.stringify({ city: 'SF' }),
          },
        ],
        input => submitted.push(input),
      ),
      prompt: 'go',
      instructions: undefined,
      tools: { weather } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
      toolApproval: { weather: 'user-approval' },
      onPendingToolApproval: approval => pending.push(approval),
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    expect(submitted).toEqual([]);
    expect(await result.finishReason).toBe('tool-calls');
    expect(pending).toEqual([
      {
        approvalId: expect.any(String),
        toolCallId: 'c1',
        toolName: 'weather',
        input: JSON.stringify({ city: 'SF' }),
        kind: 'custom',
        providerExecuted: false,
      },
    ]);
    expect(parts.map(part => part.type)).toContain('tool-approval-request');
    const approvalRequest = parts.find(
      part => part.type === 'tool-approval-request',
    ) as Extract<TextStreamPart<ToolSet>, { type: 'tool-approval-request' }>;
    expect(approvalRequest.toolCall.toolName).toBe('weather');
    expect(approvalRequest.toolCall.input).toEqual({ city: 'SF' });
  });

  test('denies custom tools configured with denied approval status', async () => {
    const submitted: SubmittedResult[] = [];
    const weather = tool({
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ temperature: 72 }),
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession(
        [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'weather',
            input: JSON.stringify({ city: 'SF' }),
          },
        ],
        input => submitted.push(input),
      ),
      prompt: 'go',
      instructions: undefined,
      tools: { weather } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
      toolApproval: {
        weather: { type: 'denied', reason: 'weather disabled' },
      },
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    expect(submitted).toEqual([
      {
        toolCallId: 'c1',
        output: {
          type: 'execution-denied',
          reason: 'weather disabled',
        },
      },
    ]);
    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-approval-request',
        isAutomatic: true,
      }),
    );
    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-approval-response',
        approved: false,
        reason: 'weather disabled',
        providerExecuted: false,
      }),
    );
  });

  test('executes an approved pending custom tool continuation', async () => {
    const submitted: SubmittedResult[] = [];
    const settled: string[] = [];
    const weather = tool({
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async (args: { city: string }) => ({
        city: args.city,
        temperature: 72,
      }),
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession([], input => submitted.push(input)),
      mode: 'continue',
      instructions: undefined,
      tools: { weather } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
      pendingToolApprovals: [
        {
          approvalId: 'approval-1',
          toolCallId: 'c1',
          toolName: 'weather',
          input: JSON.stringify({ city: 'SF' }),
          kind: 'custom',
          providerExecuted: false,
        },
      ],
      toolApprovalContinuations: [
        {
          approvalResponse: {
            type: 'tool-approval-response',
            approvalId: 'approval-1',
            approved: true,
          },
          toolCall: {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'weather',
            input: { city: 'SF' },
            providerExecuted: false,
          },
        },
      ],
      onToolApprovalSettled: approvalId => settled.push(approvalId),
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    expect(settled).toEqual(['approval-1']);
    expect(submitted).toEqual([
      { toolCallId: 'c1', output: { city: 'SF', temperature: 72 } },
    ]);
    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-approval-response',
        approvalId: 'approval-1',
        approved: true,
      }),
    );
  });

  test('does not reuse a consumed approval for replayed custom tool calls', async () => {
    const submitted: SubmittedResult[] = [];
    const pending: unknown[] = [];
    const settled: string[] = [];
    const weather = tool({
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async (args: { city: string }) => ({
        city: args.city,
        temperature: 72,
      }),
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession(
        [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'weather',
            input: JSON.stringify({ city: 'SF' }),
          },
          {
            type: 'tool-call',
            toolCallId: 'c2',
            toolName: 'weather',
            input: JSON.stringify({ city: 'Austin' }),
          },
        ],
        input => submitted.push(input),
      ),
      mode: 'continue',
      instructions: undefined,
      tools: { weather } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
      toolApproval: { weather: 'user-approval' },
      pendingToolApprovals: [
        {
          approvalId: 'approval-1',
          toolCallId: 'c1',
          toolName: 'weather',
          input: JSON.stringify({ city: 'SF' }),
          kind: 'custom',
          providerExecuted: false,
        },
      ],
      toolApprovalContinuations: [
        {
          approvalResponse: {
            type: 'tool-approval-response',
            approvalId: 'approval-1',
            approved: true,
          },
          toolCall: {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'weather',
            input: { city: 'SF' },
            providerExecuted: false,
          },
        },
      ],
      onPendingToolApproval: approval => pending.push(approval),
      onToolApprovalSettled: approvalId => settled.push(approvalId),
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    expect(settled).toEqual(['approval-1']);
    expect(submitted).toEqual([
      { toolCallId: 'c1', output: { city: 'SF', temperature: 72 } },
    ]);
    expect(pending).toEqual([
      {
        approvalId: expect.any(String),
        toolCallId: 'c2',
        toolName: 'weather',
        input: JSON.stringify({ city: 'Austin' }),
        kind: 'custom',
        providerExecuted: false,
      },
    ]);
    expect(
      parts.filter(part => part.type === 'tool-approval-request'),
    ).toContainEqual(
      expect.objectContaining({
        type: 'tool-approval-request',
        toolCall: expect.objectContaining({ toolCallId: 'c2' }),
      }),
    );
  });

  test('surfaces each generator yield as a preliminary result and submits the last yield', async () => {
    const submitted: SubmittedResult[] = [];
    const weather = tool({
      description: 'Get the weather',
      inputSchema: z.object({ city: z.string() }),
      async *execute() {
        yield { state: 'loading' as const };
        yield { state: 'ready' as const, temperature: 72 };
      },
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession(
        [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'weather',
            input: JSON.stringify({ city: 'SF' }),
          },
          ...finishEvents,
        ],
        input => submitted.push(input),
      ),
      prompt: 'go',
      instructions: undefined,
      tools: { weather } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    // Every `yield` is surfaced as a preliminary result — including the last,
    // which `executeTool` re-emits as the final value. The non-preliminary
    // final result reaches consumers only when the adapter echoes the
    // submitted result back, which the fake session does not model.
    const results = toolResultParts(parts);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.preliminary === true)).toBe(true);
    expect(results[0].output).toEqual({ state: 'loading' });
    expect(results[1].output).toEqual({ state: 'ready', temperature: 72 });

    // Only the final value is submitted back to the runtime.
    expect(submitted).toEqual([
      { toolCallId: 'c1', output: { state: 'ready', temperature: 72 } },
    ]);
  });

  test('submits a plain execute return value with no preliminary results', async () => {
    const submitted: SubmittedResult[] = [];
    const echo = tool({
      description: 'Echo the input',
      inputSchema: z.object({ text: z.string() }),
      execute: async (args: { text: string }) => ({ echoed: args.text }),
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession(
        [
          {
            type: 'tool-call',
            toolCallId: 'c1',
            toolName: 'echo',
            input: JSON.stringify({ text: 'hi' }),
          },
          ...finishEvents,
        ],
        input => submitted.push(input),
      ),
      prompt: 'go',
      instructions: undefined,
      tools: { echo } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    expect(toolResultParts(parts)).toHaveLength(0);
    expect(submitted).toEqual([{ toolCallId: 'c1', output: { echoed: 'hi' } }]);
  });

  test('strips the workDir from preliminary results before they reach consumers', async () => {
    const find = tool({
      description: 'Find a file',
      inputSchema: z.object({ name: z.string() }),
      async *execute() {
        yield { path: `${WORK_DIR}/src/foo.ts` };
      },
    });

    const { result, done } = runPrompt({
      harness,
      session: fakeSession([
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'find',
          input: JSON.stringify({ name: 'foo.ts' }),
        },
        ...finishEvents,
      ]),
      prompt: 'go',
      instructions: undefined,
      tools: { find } as ToolSet,
      toolSpecs: [],
      sandboxSession,
      sessionWorkDir: WORK_DIR,
      runtimeContext: {} as never,
      abortSignal: undefined,
    });

    const parts: TextStreamPart<ToolSet>[] = [];
    for await (const part of result.fullStream) parts.push(part);
    await done;

    const results = toolResultParts(parts);
    expect(results).toHaveLength(1);
    expect(results[0].preliminary).toBe(true);
    expect(results[0].output).toEqual({ path: 'src/foo.ts' });
  });
});
