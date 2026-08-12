import type {
  HarnessV1,
  HarnessV1Bootstrap,
  HarnessV1ContinueTurnOptions,
  HarnessV1ContinueTurnState,
  HarnessV1NetworkSandboxSession,
  HarnessV1PromptControl,
  HarnessV1PromptTurnOptions,
  HarnessV1ResumeSessionState,
  HarnessV1SandboxProvider,
  HarnessV1Session,
  HarnessV1StreamPart,
  HarnessV1ToolSpec,
} from '../v1';
import { tool } from '@ai-sdk/provider-utils';
import { NoSuchToolError } from 'ai';
import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod/v4';
import { HarnessAgent } from './harness-agent';
import { HarnessAgentSession } from './harness-agent-session';
import { HarnessCapabilityUnsupportedError } from '../errors/harness-capability-unsupported-error';
import { hashHarnessBootstrap } from './internal/bootstrap-recipe';

/**
 * Build a mock harness whose session emits a canned event script. Each
 * event is emitted synchronously; the `done` promise resolves once the
 * script has been delivered.
 *
 * The mock also records every prompt the harness receives + every tool
 * result the host submits back so tests can assert on them.
 */
function mockHarness(options: {
  script: (
    submitToolResult: (input: {
      toolCallId: string;
      output: unknown;
    }) => Promise<void>,
  ) => HarnessV1StreamPart[];
  builtinTools?: HarnessV1['builtinTools'];
  supportsBuiltinToolApprovals?: boolean;
  supportsBuiltinToolFiltering?: boolean;
  onDoStart?: (options: Parameters<HarnessV1['doStart']>[0]) => void;
  onPromptTurn?: (options: HarnessV1PromptTurnOptions) => void;
  continueScript?: (
    submitToolResult: (input: {
      toolCallId: string;
      output: unknown;
    }) => Promise<void>,
  ) => HarnessV1StreamPart[];
}): {
  harness: HarnessV1;
  prompts: HarnessV1PromptTurnOptions['prompt'][];
  toolResults: { toolCallId: string; output: unknown }[];
  toolApprovals: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }[];
  doStart: ReturnType<typeof vi.fn>;
  doDetach: ReturnType<typeof vi.fn>;
  doContinueTurn: ReturnType<typeof vi.fn>;
  doSuspendTurn: ReturnType<typeof vi.fn>;
  doStop: ReturnType<typeof vi.fn>;
  doDestroy: ReturnType<typeof vi.fn>;
  doCompact: ReturnType<typeof vi.fn>;
} {
  const prompts: HarnessV1PromptTurnOptions['prompt'][] = [];
  const toolResults: { toolCallId: string; output: unknown }[] = [];
  const toolApprovals: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }[] = [];
  const resumeState = {
    type: 'resume-session' as const,
    harnessId: 'mock',
    specificationVersion: 'harness-v1' as const,
    data: {},
  };
  const continueState = {
    type: 'continue-turn' as const,
    harnessId: 'mock',
    specificationVersion: 'harness-v1' as const,
    data: {},
  };
  const doStop = vi.fn(async () => resumeState);
  const doDestroy = vi.fn(async () => {});
  const doCompact = vi.fn(async (_customInstructions?: string) => {});
  const doDetach = vi.fn(async () => resumeState);
  const doSuspendTurn = vi.fn(async () => continueState);
  const doContinueTurn = vi.fn(async (opts: HarnessV1ContinueTurnOptions) => {
    const control: HarnessV1PromptControl = {
      submitToolResult: async input => {
        toolResults.push(input);
      },
      submitToolApproval: async input => {
        toolApprovals.push(input);
      },
      done: Promise.resolve(),
    };
    const events =
      options.continueScript?.(async input => {
        await control.submitToolResult(input);
      }) ?? [];
    queueMicrotask(() => {
      for (const event of events) opts.emit(event);
    });
    return control;
  });
  let session: HarnessV1Session;
  const doStart = vi.fn(async (opts: Parameters<HarnessV1['doStart']>[0]) => {
    options.onDoStart?.(opts);
    return session;
  });

  session = {
    sessionId: 'mock-session-1',
    isResume: false,
    doPromptTurn: async (opts: HarnessV1PromptTurnOptions) => {
      prompts.push(opts.prompt);
      options.onPromptTurn?.(opts);
      const control: HarnessV1PromptControl = {
        submitToolResult: async input => {
          toolResults.push(input);
        },
        submitToolApproval: async input => {
          toolApprovals.push(input);
        },
        done: Promise.resolve(),
      };
      const events = options.script(async input => {
        await control.submitToolResult(input);
      });
      // Emit on a microtask so the consumer can await doPromptTurn first.
      queueMicrotask(() => {
        for (const event of events) opts.emit(event);
      });
      return control;
    },
    doCompact,
    doDetach,
    doStop,
    doDestroy,
    doContinueTurn,
    doSuspendTurn,
  };

  return {
    harness: {
      specificationVersion: 'harness-v1',
      harnessId: 'mock',
      builtinTools: options.builtinTools ?? {},
      ...(options.supportsBuiltinToolApprovals !== undefined
        ? { supportsBuiltinToolApprovals: options.supportsBuiltinToolApprovals }
        : {}),
      ...(options.supportsBuiltinToolFiltering !== undefined
        ? {
            supportsBuiltinToolFiltering: options.supportsBuiltinToolFiltering,
          }
        : {}),
      doStart,
    },
    prompts,
    toolResults,
    toolApprovals,
    doStart,
    doDetach,
    doContinueTurn,
    doSuspendTurn,
    doStop,
    doDestroy,
    doCompact,
  };
}

function makeSandboxSession(
  options: Partial<HarnessV1NetworkSandboxSession> = {},
): HarnessV1NetworkSandboxSession {
  const run = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
  const sandboxSession = {
    id: 'sandbox',
    defaultWorkingDirectory: '/work',
    ports: [],
    getPortUrl: async () => 'ws://example.test/',
    run,
    stop: vi.fn(async () => {}),
    destroy: vi.fn(async () => {}),
    restricted: () => ({ run }) as never,
    ...options,
  } as unknown as HarnessV1NetworkSandboxSession;
  return sandboxSession;
}

function makeSandboxProvider(
  sandboxSession = makeSandboxSession(),
): HarnessV1SandboxProvider {
  return {
    specificationVersion: 'harness-sandbox-v1',
    providerId: 'mock-sandbox',
    createSession: async () => sandboxSession,
    resumeSession: async () => sandboxSession,
  };
}

function zeroUsage() {
  return {
    inputTokens: {
      total: undefined,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: undefined,
      text: undefined,
      reasoning: undefined,
    },
  };
}

function finishEvents(): HarnessV1StreamPart[] {
  return [
    {
      type: 'finish-step',
      finishReason: { unified: 'tool-calls', raw: 'tool_use' },
      usage: zeroUsage(),
    },
    {
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: 'tool_use' },
      totalUsage: zeroUsage(),
    },
  ];
}

function makeLifecycleSession(options: {
  underlyingSession?: Partial<HarnessV1Session>;
  sandboxSessionOverrides?: Partial<HarnessV1NetworkSandboxSession>;
  turnState?: 'idle' | 'running' | 'awaiting-approval' | 'suspended';
}): {
  session: HarnessAgentSession;
  resumeState: HarnessV1ResumeSessionState;
  continueState: HarnessV1ContinueTurnState;
  doDetach: ReturnType<typeof vi.fn>;
  doStop: ReturnType<typeof vi.fn>;
  doDestroy: ReturnType<typeof vi.fn>;
  sandboxStop: ReturnType<typeof vi.fn>;
  sandboxDestroy: ReturnType<typeof vi.fn>;
} {
  const resumeState: HarnessV1ResumeSessionState = {
    type: 'resume-session',
    harnessId: 'mock',
    specificationVersion: 'harness-v1',
    data: {},
  };
  const continueState: HarnessV1ContinueTurnState = {
    type: 'continue-turn',
    harnessId: 'mock',
    specificationVersion: 'harness-v1',
    data: {},
  };
  const doDetach = vi.fn(async () => resumeState);
  const doStop = vi.fn(async () => resumeState);
  const doDestroy = vi.fn(async () => {});
  const sandboxStop = vi.fn(async () => {});
  const sandboxDestroy = vi.fn(async () => {});
  const harness: HarnessV1 = {
    specificationVersion: 'harness-v1',
    harnessId: 'mock',
    builtinTools: {},
    doStart: async () => {
      throw new Error('not used');
    },
  };
  const underlyingSession = {
    sessionId: 'lifecycle-session',
    isResume: false,
    doPromptTurn: async () => ({
      submitToolResult: async () => {},
      done: Promise.resolve(),
    }),
    doContinueTurn: async () => ({
      submitToolResult: async () => {},
      done: Promise.resolve(),
    }),
    doCompact: async () => {},
    doDetach,
    doStop,
    doDestroy,
    doSuspendTurn: async () => continueState,
    ...options.underlyingSession,
  } as HarnessV1Session;
  const sandboxSession = {
    id: 'sandbox',
    defaultWorkingDirectory: '/work',
    ports: [],
    getPortUrl: async () => 'ws://example.test/',
    stop: sandboxStop,
    destroy: sandboxDestroy,
    restricted: () => ({}) as never,
    ...options.sandboxSessionOverrides,
  } as unknown as HarnessV1NetworkSandboxSession;
  const sandboxProvider = makeSandboxProvider(sandboxSession);

  return {
    session: new HarnessAgentSession({
      sessionId: 'lifecycle-session',
      harness,
      underlyingSession,
      sandboxSession,
      sandboxProvider,
      sessionWorkDir: '/work/mock-lifecycle-session',
      toolApproval: undefined,
      turnState: options.turnState,
    }),
    resumeState,
    continueState,
    doDetach,
    doStop,
    doDestroy,
    sandboxStop,
    sandboxDestroy,
  };
}

describe('HarnessAgent', () => {
  test('exposes the AI SDK Agent contract surface', () => {
    const { harness } = mockHarness({ script: () => [] });
    const agent = new HarnessAgent({
      harness,
      id: 'a1',
      sandbox: makeSandboxProvider(),
    });
    expect(agent.version).toBe('agent-v1');
    expect(agent.id).toBe('a1');
    expect(agent.harnessId).toBe('mock');
    expect(agent.tools).toEqual({});
  });

  test('generate() returns text + steps for a simple text-only turn', async () => {
    const { harness } = mockHarness({
      script: () => [
        { type: 'stream-start' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Hello, ' },
        { type: 'text-delta', id: 't1', delta: 'world.' },
        { type: 'text-end', id: 't1' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: 'end_turn' },
          usage: {
            inputTokens: {
              total: 5,
              noCache: 5,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 2, text: 2, reasoning: undefined },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'end_turn' },
          totalUsage: {
            inputTokens: {
              total: 5,
              noCache: 5,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 2, text: 2, reasoning: undefined },
          },
        },
      ],
    });

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();
    const result = await agent.generate({ session, prompt: 'hi' });

    expect(result.text).toBe('Hello, world.');
    expect(result.finishReason).toBe('stop');
    expect(result.rawFinishReason).toBe('end_turn');
    expect(result.usage.inputTokens).toBe(5);
    expect(result.usage.outputTokens).toBe(2);
    expect(result.usage.totalTokens).toBe(7);
    expect(result.steps).toHaveLength(1);
    expect(result.finalStep.text).toBe('Hello, world.');
    expect(result.toolCalls).toEqual([]);
    expect(result.toolResults).toEqual([]);
    expect(result.responseMessages).toHaveLength(1);
    expect(result.responseMessages[0]!.role).toBe('assistant');

    await session.destroy();
  });

  test('stream() returns a result whose fullStream emits translated parts', async () => {
    const { harness } = mockHarness({
      script: () => [
        { type: 'stream-start' },
        { type: 'text-delta', id: 't1', delta: 'Hi' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
    });

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();
    const result = await agent.stream({ session, prompt: 'hi' });

    const types: string[] = [];
    for await (const part of result.fullStream) {
      types.push(part.type);
    }

    expect(types).toContain('text-delta');
    expect(types).toContain('finish-step');
    expect(types).toContain('finish');
    expect(await result.text).toBe('Hi');

    await session.destroy();
  });

  test('continueStream() continues an in-flight turn and streams translated parts', async () => {
    const { harness, doContinueTurn, prompts } = mockHarness({
      script: () => [],
      continueScript: () => [
        { type: 'stream-start' },
        { type: 'text-delta', id: 't1', delta: 'Still running' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
    });

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession({
      continueFrom: {
        type: 'continue-turn',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: {},
      },
    });
    const result = await agent.continueStream({ session });

    const types: string[] = [];
    for await (const part of result.fullStream) {
      types.push(part.type);
    }

    expect(types).toContain('text-delta');
    expect(types).toContain('finish-step');
    expect(types).toContain('finish');
    expect(await result.text).toBe('Still running');
    expect(prompts).toEqual([]);
    expect(doContinueTurn).toHaveBeenCalledTimes(1);

    await session.destroy();
  });

  test('continueGenerate() continues an in-flight turn and returns generated text', async () => {
    const { harness, doContinueTurn, prompts } = mockHarness({
      script: () => [],
      continueScript: () => [
        { type: 'stream-start' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Completed' },
        { type: 'text-end', id: 't1' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: 'end_turn' },
          usage: {
            inputTokens: {
              total: 3,
              noCache: 3,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'end_turn' },
          totalUsage: {
            inputTokens: {
              total: 3,
              noCache: 3,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
        },
      ],
    });

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession({
      continueFrom: {
        type: 'continue-turn',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: {},
      },
    });
    const result = await agent.continueGenerate({ session });

    expect(result.text).toBe('Completed');
    expect(result.finishReason).toBe('stop');
    expect(result.rawFinishReason).toBe('end_turn');
    expect(result.usage.inputTokens).toBe(3);
    expect(result.usage.outputTokens).toBe(1);
    expect(prompts).toEqual([]);
    expect(doContinueTurn).toHaveBeenCalledTimes(1);

    await session.destroy();
  });

  test('continueStream() rejects when there is no unfinished turn', async () => {
    const { harness } = mockHarness({ script: () => [] });
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();

    await expect(agent.continueStream({ session })).rejects.toThrow(
      /no unfinished turn to continue/,
    );

    await session.destroy();
  });

  test('resumeFrom.continueFrom resumes a session that must continue before accepting a new prompt', async () => {
    const { harness, doContinueTurn, prompts } = mockHarness({
      script: () => [
        { type: 'text-delta', id: 't2', delta: 'after' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
      continueScript: () => [
        { type: 'text-delta', id: 't1', delta: 'continued' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
    });

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession({
      sessionId: 's1',
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: {},
        continueFrom: {
          type: 'continue-turn',
          harnessId: 'mock',
          specificationVersion: 'harness-v1',
          data: {},
        },
      },
    });

    await expect(
      agent.generate({ session, prompt: 'new prompt too early' }),
    ).rejects.toThrow(/must be continued/);

    const continued = await agent.continueGenerate({ session });
    expect(continued.text).toBe('continued');
    const after = await agent.generate({ session, prompt: 'new prompt now' });
    expect(after.text).toBe('after');

    expect(doContinueTurn).toHaveBeenCalledTimes(1);
    expect(prompts).toEqual(['new prompt now']);

    await session.destroy();
  });

  test('sandboxConfig.onSession runs after the session work dir exists and before harness start', async () => {
    const { harness, doStart } = mockHarness({ script: () => [] });
    const run = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const restrictedSession = { label: 'restricted', run };
    const sandboxSession = makeSandboxSession({
      run,
      restricted: () => restrictedSession as never,
    });
    const onSandboxSession = vi.fn(async () => {});
    const agent = new HarnessAgent({
      harness,
      sandbox: makeSandboxProvider(sandboxSession),
      sandboxConfig: { onSession: onSandboxSession },
    });

    const session = await agent.createSession({ sessionId: 's1' });

    expect(run).toHaveBeenCalledWith({
      command: 'mkdir -p "$WORK_DIR"',
      env: { WORK_DIR: '/work/mock-s1' },
      abortSignal: undefined,
    });
    expect(onSandboxSession).toHaveBeenCalledWith({
      session: restrictedSession,
      sessionWorkDir: '/work/mock-s1',
      abortSignal: undefined,
    });
    expect(run.mock.invocationCallOrder[0]!).toBeLessThan(
      onSandboxSession.mock.invocationCallOrder[0]!,
    );
    expect(onSandboxSession.mock.invocationCallOrder[0]!).toBeLessThan(
      doStart.mock.invocationCallOrder[0]!,
    );

    await session.destroy();
  });

  test('deprecated top-level onSandboxSession warns and still runs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { harness } = mockHarness({ script: () => [] });
      const onSandboxSession = vi.fn(async () => {});
      const agent = new HarnessAgent({
        harness,
        sandbox: makeSandboxProvider(),
        onSandboxSession,
      });

      const session = await agent.createSession({ sessionId: 's1' });

      expect(warn).toHaveBeenCalledWith(
        'HarnessAgent: `onSandboxSession` is deprecated. Use `sandboxConfig.onSession` instead.',
      );
      expect(onSandboxSession).toHaveBeenCalledWith({
        session: expect.any(Object),
        sessionWorkDir: '/work/mock-s1',
        abortSignal: undefined,
      });

      await session.destroy();
    } finally {
      warn.mockRestore();
    }
  });

  test('validates sandbox bootstrap settings', () => {
    const { harness } = mockHarness({ script: () => [] });

    expect(
      () =>
        new HarnessAgent({
          harness,
          sandbox: makeSandboxProvider(),
          sandboxConfig: { onBootstrap: async () => {} },
        }),
    ).toThrow(/must be provided together/);

    expect(
      () =>
        new HarnessAgent({
          harness,
          sandbox: makeSandboxProvider(),
          sandboxConfig: { bootstrapHash: 'hash' },
        }),
    ).toThrow(/must be provided together/);

    expect(
      () =>
        new HarnessAgent({
          harness,
          sandbox: makeSandboxProvider(),
          sandboxConfig: { workDir: '../repo' },
        }),
    ).toThrow(/workDir/);
  });

  test('sandboxConfig.onBootstrap runs during onFirstCreate and workDir becomes the session work dir', async () => {
    const { harness } = mockHarness({ script: () => [] });
    const run = vi.fn(async (args: { command: string }) => {
      if (args.command === 'pwd') {
        return { exitCode: 0, stdout: '/work\n', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    const restrictedSession = {
      label: 'restricted',
      run,
    };
    const sandboxSession = makeSandboxSession({
      run,
      restricted: () => restrictedSession as never,
    });
    const createSession = vi.fn(
      async (
        opts: Parameters<HarnessV1SandboxProvider['createSession']>[0],
      ) => {
        await opts?.onFirstCreate?.(restrictedSession as never, {});
        return sandboxSession;
      },
    );
    const onSandboxBootstrap = vi.fn(async () => {});
    const onSandboxSession = vi.fn(async () => {});
    const agent = new HarnessAgent({
      harness,
      sandbox: {
        specificationVersion: 'harness-sandbox-v1',
        providerId: 'mock-sandbox',
        createSession,
      },
      sandboxConfig: {
        workDir: 'ai-sdk',
        bootstrapHash: 'repo-v1',
        onBootstrap: onSandboxBootstrap,
        onSession: onSandboxSession,
      },
    });

    const session = await agent.createSession({ sessionId: 's1' });

    expect(createSession.mock.calls[0]![0]).toEqual({
      sessionId: 's1',
      abortSignal: undefined,
      identity: expect.stringMatching(/^[0-9a-f]{16}$/),
      onFirstCreate: expect.any(Function),
    });
    expect(onSandboxBootstrap).toHaveBeenCalledWith({
      session: restrictedSession,
      workDir: '/work/ai-sdk',
      abortSignal: undefined,
    });
    expect(onSandboxSession).toHaveBeenCalledWith({
      session: restrictedSession,
      sessionWorkDir: '/work/ai-sdk',
      abortSignal: undefined,
    });

    await session.destroy();
  });

  test('sandboxConfig.onBootstrap is skipped for resumed sessions while onSession still runs', async () => {
    const { harness } = mockHarness({ script: () => [] });
    const onSandboxBootstrap = vi.fn(async () => {});
    const onSandboxSession = vi.fn(async () => {});
    const agent = new HarnessAgent({
      harness,
      sandbox: makeSandboxProvider(),
      sandboxConfig: {
        workDir: 'ai-sdk',
        bootstrapHash: 'repo-v1',
        onBootstrap: onSandboxBootstrap,
        onSession: onSandboxSession,
      },
    });

    const session = await agent.createSession({
      sessionId: 's1',
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: {},
      },
    });

    expect(onSandboxBootstrap).not.toHaveBeenCalled();
    expect(onSandboxSession).toHaveBeenCalledWith({
      session: expect.any(Object),
      sessionWorkDir: '/work/ai-sdk',
      abortSignal: undefined,
    });

    await session.destroy();
  });

  test('built-in bootstrap uses recipe identity while snapshot identity includes workDir', async () => {
    const base = mockHarness({ script: () => [] });
    const recipe: HarnessV1Bootstrap = {
      harnessId: 'mock',
      bootstrapDir: '/tmp/mock-bootstrap',
      files: [],
      commands: [],
    };
    const harness: HarnessV1 = {
      ...base.harness,
      getBootstrap: vi.fn(async () => recipe),
    };
    const readTextFile = vi.fn(async () => null);
    const writeTextFile = vi.fn(async () => {});
    const run = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const restrictedSession = {
      run,
      readTextFile,
      writeTextFile,
    };
    const sandboxSession = makeSandboxSession({
      run,
      restricted: () => restrictedSession as never,
    });
    const createSession = vi.fn(
      async (
        opts: Parameters<HarnessV1SandboxProvider['createSession']>[0],
      ) => {
        await opts?.onFirstCreate?.(restrictedSession as never, {});
        return sandboxSession;
      },
    );
    const agent = new HarnessAgent({
      harness,
      sandbox: {
        specificationVersion: 'harness-sandbox-v1',
        providerId: 'mock-sandbox',
        createSession,
      },
      sandboxConfig: { workDir: 'ai-sdk' },
    });

    const session = await agent.createSession({ sessionId: 's1' });

    expect(createSession.mock.calls[0]![0]?.identity).toMatch(/^[0-9a-f]{16}$/);
    expect(createSession.mock.calls[0]![0]?.identity).not.toBe(
      await hashHarnessBootstrap(recipe),
    );
    const writeCalls = writeTextFile.mock.calls as unknown as Array<
      [{ path: string }]
    >;
    const markerWrite = writeCalls.at(-1)?.[0];
    expect(markerWrite?.path).toMatch(
      /^\/tmp\/mock-bootstrap\/\.bootstrap-[0-9a-f]{16}\.ok$/,
    );

    await session.destroy();
  });

  test('sandboxConfig.onSession runs for resumed sessions', async () => {
    const { harness } = mockHarness({ script: () => [] });
    const sandboxSessionEvents: Array<{ sessionWorkDir: string }> = [];
    const onSandboxSession = vi.fn(async (opts: { sessionWorkDir: string }) => {
      sandboxSessionEvents.push({ sessionWorkDir: opts.sessionWorkDir });
    });
    const agent = new HarnessAgent({
      harness,
      sandbox: makeSandboxProvider(),
      sandboxConfig: { onSession: onSandboxSession },
    });

    const session = await agent.createSession({
      sessionId: 's1',
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: {},
      },
    });

    expect(onSandboxSession).toHaveBeenCalledTimes(1);
    expect(sandboxSessionEvents).toEqual([{ sessionWorkDir: '/work/mock-s1' }]);

    await session.destroy();
  });

  test('createSession() rejects resume state with top-level pending tool approvals', async () => {
    const { harness } = mockHarness({ script: () => [] });
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });

    await expect(
      agent.createSession({
        resumeFrom: {
          type: 'resume-session',
          harnessId: 'mock',
          specificationVersion: 'harness-v1',
          data: {},
          pendingToolApprovals: [],
        } as HarnessV1ResumeSessionState,
      }),
    ).rejects.toThrow(/cannot contain pending tool approvals/);
  });

  test('host-side tools are executed and the result is submitted back', async () => {
    const { harness, toolResults } = mockHarness({
      script: () => [
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'echo',
          input: JSON.stringify({ value: 'ping' }),
        },
        {
          type: 'finish-step',
          finishReason: { unified: 'tool-calls', raw: 'tool_use' },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'tool-calls', raw: 'tool_use' },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
    });

    const echo = tool({
      description: 'Echo a string',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }: { value: string }) => ({ echoed: value }),
    });

    const agent = new HarnessAgent({
      harness,
      tools: { echo },
      sandbox: makeSandboxProvider(),
    });
    const session = await agent.createSession();
    const result = await agent.generate({ session, prompt: 'go' });

    expect(toolResults).toEqual([
      { toolCallId: 'c1', output: { echoed: 'ping' } },
    ]);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.toolName).toBe('echo');

    await session.destroy();
  });

  test('rejects activeTools and inactiveTools together at runtime', () => {
    const { harness } = mockHarness({ script: () => [] });

    expect(
      () =>
        new HarnessAgent({
          harness,
          activeTools: [],
          inactiveTools: [],
          sandbox: makeSandboxProvider(),
        } as never),
    ).toThrow(/either `activeTools` or `inactiveTools`/);
  });

  test('rejects unknown active tool names', () => {
    const { harness } = mockHarness({ script: () => [] });

    expect(
      () =>
        new HarnessAgent({
          harness,
          activeTools: ['missing'],
          sandbox: makeSandboxProvider(),
        }),
    ).toThrow(NoSuchToolError);
  });

  test('activeTools filters custom tool specs and blocks inactive custom execution', async () => {
    const receivedToolSpecs: HarnessV1ToolSpec[][] = [];
    const { harness, toolResults } = mockHarness({
      onPromptTurn: opts => {
        receivedToolSpecs.push([...(opts.tools ?? [])]);
      },
      script: () => [
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'hidden',
          input: JSON.stringify({ value: 'ping' }),
        },
        ...finishEvents(),
      ],
    });
    const echo = tool({
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }: { value: string }) => ({ echoed: value }),
    });
    const hidden = tool({
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }: { value: string }) => ({ hidden: value }),
    });
    const agent = new HarnessAgent({
      harness,
      tools: { echo, hidden },
      activeTools: ['echo'],
      sandbox: makeSandboxProvider(),
    });
    const session = await agent.createSession();

    await agent.generate({ session, prompt: 'go' });

    expect(receivedToolSpecs[0]?.map(spec => spec.name)).toEqual(['echo']);
    expect(toolResults).toEqual([
      {
        toolCallId: 'c1',
        output: {
          type: 'execution-denied',
          reason:
            "Tool 'hidden' is inactive due to the HarnessAgent tool filtering policy.",
        },
      },
    ]);
    await session.destroy();
  });

  test('inactiveTools filters custom tool specs and blocks inactive custom execution', async () => {
    const receivedToolSpecs: HarnessV1ToolSpec[][] = [];
    const { harness, toolResults } = mockHarness({
      onPromptTurn: opts => {
        receivedToolSpecs.push([...(opts.tools ?? [])]);
      },
      script: () => [
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'hidden',
          input: JSON.stringify({ value: 'ping' }),
        },
        ...finishEvents(),
      ],
    });
    const echo = tool({
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }: { value: string }) => ({ echoed: value }),
    });
    const hidden = tool({
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }: { value: string }) => ({ hidden: value }),
    });
    const agent = new HarnessAgent({
      harness,
      tools: { echo, hidden },
      inactiveTools: ['hidden'],
      sandbox: makeSandboxProvider(),
    });
    const session = await agent.createSession();

    await agent.generate({ session, prompt: 'go' });

    expect(receivedToolSpecs[0]?.map(spec => spec.name)).toEqual(['echo']);
    expect(toolResults[0]?.output).toMatchObject({
      type: 'execution-denied',
    });
    await session.destroy();
  });

  test('rejects builtin filtering when the harness cannot enforce it', () => {
    const { harness } = mockHarness({
      builtinTools: {
        bash: tool({
          inputSchema: z.object({ command: z.string() }),
        }),
      },
      script: () => [],
    });

    expect(
      () =>
        new HarnessAgent({
          harness,
          activeTools: [],
          sandbox: makeSandboxProvider(),
        }),
    ).toThrow(HarnessCapabilityUnsupportedError);
  });

  test('passes builtin filtering policy to approval-capable harnesses', async () => {
    let startBuiltinFiltering:
      | Parameters<HarnessV1['doStart']>[0]['builtinToolFiltering']
      | undefined;
    const { harness } = mockHarness({
      builtinTools: {
        bash: tool({
          inputSchema: z.object({ command: z.string() }),
        }),
      },
      supportsBuiltinToolApprovals: true,
      onDoStart: opts => {
        startBuiltinFiltering = opts.builtinToolFiltering;
      },
      script: () => finishEvents(),
    });
    const agent = new HarnessAgent({
      harness,
      activeTools: [],
      sandbox: makeSandboxProvider(),
    });
    const session = await agent.createSession();

    expect(startBuiltinFiltering).toEqual({ mode: 'allow', toolNames: [] });
    await session.destroy();
  });

  test('auto-denies inactive builtin approvals without approval stream parts', async () => {
    const { harness, toolApprovals } = mockHarness({
      builtinTools: {
        bash: tool({
          inputSchema: z.object({ command: z.string() }),
        }),
      },
      supportsBuiltinToolApprovals: true,
      script: () => [
        {
          type: 'tool-call',
          toolCallId: 'b1',
          toolName: 'bash',
          input: JSON.stringify({ command: 'pwd' }),
          providerExecuted: true,
        },
        {
          type: 'tool-approval-request',
          approvalId: 'b1',
          toolCallId: 'b1',
        },
        ...finishEvents(),
      ],
    });
    const agent = new HarnessAgent({
      harness,
      inactiveTools: ['bash'],
      sandbox: makeSandboxProvider(),
    });
    const session = await agent.createSession();
    const result = await agent.stream({ session, prompt: 'go' });
    const parts: string[] = [];

    for await (const part of result.fullStream) {
      parts.push(part.type);
    }

    expect(parts).not.toContain('tool-approval-request');
    expect(parts).not.toContain('tool-approval-response');
    expect(toolApprovals).toEqual([
      {
        approvalId: 'b1',
        approved: false,
        reason:
          "Tool 'bash' is inactive due to the HarnessAgent tool filtering policy.",
      },
    ]);
    await session.destroy();
  });

  test('session.detach() after a tool approval pause returns resume state with nested continuation state', async () => {
    const { harness, doDetach, doSuspendTurn } = mockHarness({
      script: () => [
        {
          type: 'tool-call',
          toolCallId: 'c1',
          toolName: 'weather',
          input: JSON.stringify({ city: 'SF' }),
        },
      ],
    });
    const weather = tool({
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }: { city: string }) => ({ city }),
    });
    const agent = new HarnessAgent({
      harness,
      tools: { weather },
      toolApproval: { weather: 'user-approval' },
      sandbox: makeSandboxProvider(),
    });
    const session = await agent.createSession();
    const result = await agent.stream({ session, prompt: 'go' });

    const parts: string[] = [];
    for await (const part of result.fullStream) {
      parts.push(part.type);
    }
    const state = await session.detach();

    expect(parts).toContain('tool-approval-request');
    expect(state).toEqual({
      type: 'resume-session',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: {},
      continueFrom: {
        type: 'continue-turn',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: {},
        pendingToolApprovals: [
          {
            approvalId: expect.any(String),
            toolCallId: 'c1',
            toolName: 'weather',
            input: JSON.stringify({ city: 'SF' }),
            kind: 'custom',
            providerExecuted: false,
          },
        ],
      },
    });
    expect(doDetach).not.toHaveBeenCalled();
    expect(doSuspendTurn).toHaveBeenCalledTimes(1);
  });

  test('session.detach() from UI stream onFinish uses between-turn resume state after normal completion', async () => {
    const { harness, doDetach, doSuspendTurn } = mockHarness({
      script: () => [
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'done' },
        { type: 'text-end', id: 't1' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
    });
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();
    const result = await agent.stream({ session, prompt: 'go' });
    let detachState: HarnessV1ResumeSessionState | undefined;

    const uiStream = result.toUIMessageStream({
      onFinish: async () => {
        detachState = await session.detach();
      },
    });
    for await (const chunk of uiStream) {
      expect(chunk).toBeDefined();
    }

    expect(detachState).toEqual({
      type: 'resume-session',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: {},
    });
    expect(doDetach).toHaveBeenCalledTimes(1);
    expect(doSuspendTurn).not.toHaveBeenCalled();
  });

  test('a single session can drive multiple generate() turns', async () => {
    const { harness, prompts, doDestroy } = mockHarness({
      script: () => [
        { type: 'text-delta', id: 't', delta: 'ok' },
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ],
    });

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();
    await agent.generate({ session, prompt: 'one' });
    await agent.generate({ session, prompt: 'two' });

    expect(prompts).toHaveLength(2);
    expect(doDestroy).not.toHaveBeenCalled();

    await session.destroy();
    expect(doDestroy).toHaveBeenCalledTimes(1);
  });

  test('session.destroy() is idempotent and rejects further turns', async () => {
    const { harness, doDestroy } = mockHarness({ script: () => [] });
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();

    await session.destroy();
    await session.destroy();
    expect(doDestroy).toHaveBeenCalledTimes(1);

    await expect(
      agent.generate({ session, prompt: 'after destroy' }),
    ).rejects.toThrow(/has ended/);
  });

  test('normalizes prompt input — string passes through, message array is reduced to the last user message', async () => {
    function finishOnly(): HarnessV1StreamPart[] {
      return [
        {
          type: 'finish-step',
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          totalUsage: {
            inputTokens: {
              total: undefined,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: undefined,
              text: undefined,
              reasoning: undefined,
            },
          },
        },
      ];
    }

    const { harness, prompts } = mockHarness({ script: finishOnly });
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();

    await agent.generate({ session, prompt: 'plain string' });
    await agent.generate({
      session,
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'older user turn — dropped' },
        { role: 'assistant', content: 'older assistant turn — dropped' },
        { role: 'user', content: 'latest user turn' },
      ],
    });
    await agent.generate({
      session,
      prompt: [
        { role: 'user', content: 'discarded' },
        { role: 'assistant', content: 'discarded too' },
        { role: 'user', content: [{ type: 'text', text: 'final turn' }] },
      ],
    });

    expect(prompts).toEqual([
      'plain string',
      { role: 'user', content: 'latest user turn' },
      { role: 'user', content: [{ type: 'text', text: 'final turn' }] },
    ]);

    await expect(
      agent.generate({
        session,
        messages: [
          { role: 'system', content: 'no user message here' },
          { role: 'assistant', content: 'nothing for the harness to run' },
        ],
      }),
    ).rejects.toThrow(/at least one `role: "user"` entry/);

    await session.destroy();
  });

  test('session.detach() parks without stopping or destroying the sandbox', async () => {
    const {
      session,
      resumeState,
      doDetach,
      doStop,
      doDestroy,
      sandboxStop,
      sandboxDestroy,
    } = makeLifecycleSession({});

    await expect(session.detach()).resolves.toEqual(resumeState);

    expect(doDetach).toHaveBeenCalledTimes(1);
    expect(doStop).not.toHaveBeenCalled();
    expect(doDestroy).not.toHaveBeenCalled();
    expect(sandboxStop).not.toHaveBeenCalled();
    expect(sandboxDestroy).not.toHaveBeenCalled();
  });

  test('session.stop() saves state and stops the sandbox', async () => {
    const {
      session,
      resumeState,
      doDetach,
      doStop,
      doDestroy,
      sandboxStop,
      sandboxDestroy,
    } = makeLifecycleSession({});

    await expect(session.stop()).resolves.toEqual(resumeState);

    expect(doDetach).not.toHaveBeenCalled();
    expect(doStop).toHaveBeenCalledTimes(1);
    expect(doDestroy).not.toHaveBeenCalled();
    expect(sandboxStop).toHaveBeenCalledTimes(1);
    expect(sandboxDestroy).not.toHaveBeenCalled();
  });

  test('session.stop() wraps unfinished turns as nested continuation state and stops the sandbox', async () => {
    const {
      session,
      continueState,
      doStop,
      doDestroy,
      sandboxStop,
      sandboxDestroy,
    } = makeLifecycleSession({ turnState: 'suspended' });

    await expect(session.stop()).resolves.toEqual({
      type: 'resume-session',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: continueState.data,
      continueFrom: continueState,
    });

    expect(doStop).not.toHaveBeenCalled();
    expect(doDestroy).not.toHaveBeenCalled();
    expect(sandboxStop).toHaveBeenCalledTimes(1);
    expect(sandboxDestroy).not.toHaveBeenCalled();
  });

  test('session.suspendTurn() returns raw continuation state and detaches the local handle', async () => {
    const { session, continueState, doDetach, doStop, sandboxStop } =
      makeLifecycleSession({ turnState: 'running' });

    await expect(session.suspendTurn()).resolves.toEqual(continueState);

    expect(doDetach).not.toHaveBeenCalled();
    expect(doStop).not.toHaveBeenCalled();
    expect(sandboxStop).not.toHaveBeenCalled();
    await expect(session.suspendTurn()).rejects.toThrow(/not active/);
  });

  test('session.destroy() destroys the sandbox without saving state', async () => {
    const {
      session,
      doDetach,
      doStop,
      doDestroy,
      sandboxStop,
      sandboxDestroy,
    } = makeLifecycleSession({});

    await session.destroy();

    expect(doDetach).not.toHaveBeenCalled();
    expect(doStop).not.toHaveBeenCalled();
    expect(doDestroy).toHaveBeenCalledTimes(1);
    expect(sandboxStop).not.toHaveBeenCalled();
    expect(sandboxDestroy).toHaveBeenCalledTimes(1);
  });

  test('session.destroy() falls back to stopping the sandbox when destroy is unsupported', async () => {
    const { session, sandboxStop, sandboxDestroy } = makeLifecycleSession({
      sandboxSessionOverrides: { destroy: undefined },
    });

    await session.destroy();

    expect(sandboxStop).toHaveBeenCalledTimes(1);
    expect(sandboxDestroy).not.toHaveBeenCalled();
  });

  test('session.compact() forwards to the harness session doCompact, then throws once ended', async () => {
    const { harness, doCompact } = mockHarness({ script: () => [] });
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();

    await session.compact();
    await session.compact('keep the error trace');
    expect(doCompact).toHaveBeenCalledTimes(2);
    expect(doCompact).toHaveBeenNthCalledWith(1, undefined);
    expect(doCompact).toHaveBeenNthCalledWith(2, 'keep the error trace');

    await session.destroy();
    await expect(session.compact()).rejects.toThrow(/ended/i);
  });

  test('session.detach() returns validated coords, surfaces resume status, and ends the local handle', async () => {
    const doStop = vi.fn(async () => ({
      type: 'resume-session' as const,
      harnessId: 'mock',
      specificationVersion: 'harness-v1' as const,
      data: {},
    }));
    const doDestroy = vi.fn(async () => {});
    const underlying: HarnessV1Session = {
      sessionId: 's-attach',
      isResume: true,
      doPromptTurn: async (opts: HarnessV1PromptTurnOptions) => {
        queueMicrotask(() => opts.emit({ type: 'finish' } as never));
        return { submitToolResult: async () => {}, done: Promise.resolve() };
      },
      doCompact: async () => {},
      doStop,
      doDestroy,
      doDetach: async () => ({
        type: 'resume-session',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: { bridge: { port: 5001, token: 't', lastSeenEventId: 3 } },
      }),
      doContinueTurn: async () => ({
        submitToolResult: async () => {},
        done: Promise.resolve(),
      }),
      doSuspendTurn: async () => ({
        type: 'continue-turn',
        harnessId: 'mock',
        specificationVersion: 'harness-v1',
        data: { bridge: { port: 5001, token: 't', lastSeenEventId: 3 } },
      }),
    };
    const harness: HarnessV1 = {
      specificationVersion: 'harness-v1',
      harnessId: 'mock',
      builtinTools: {},
      lifecycleStateSchema: z.object({
        bridge: z
          .object({
            port: z.number(),
            token: z.string(),
            lastSeenEventId: z.number(),
          })
          .optional(),
      }),
      doStart: async () => underlying,
    };

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();
    expect(session.isResume).toBe(true);

    const handle = await session.detach();
    expect(handle).toEqual({
      type: 'resume-session',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: { bridge: { port: 5001, token: 't', lastSeenEventId: 3 } },
    });
    expect(doStop).not.toHaveBeenCalled();
    expect(doDestroy).not.toHaveBeenCalled();

    await expect(
      agent.generate({ session, prompt: 'after detach' }),
    ).rejects.toThrow(/has ended/);
  });

  test('session.stop() returns validated state and ends the local handle', async () => {
    const resumeState = {
      type: 'resume-session' as const,
      harnessId: 'mock',
      specificationVersion: 'harness-v1' as const,
      data: { value: 'saved' },
    };
    const continueState = {
      type: 'continue-turn' as const,
      harnessId: 'mock',
      specificationVersion: 'harness-v1' as const,
      data: { value: 'saved' },
    };
    const doStop = vi.fn(async () => resumeState);
    const doDestroy = vi.fn(async () => {});
    const underlying: HarnessV1Session = {
      sessionId: 's-stop',
      isResume: false,
      doPromptTurn: async () => ({
        submitToolResult: async () => {},
        done: Promise.resolve(),
      }),
      doCompact: async () => {},
      doDetach: async () => resumeState,
      doStop,
      doDestroy,
      doContinueTurn: async () => ({
        submitToolResult: async () => {},
        done: Promise.resolve(),
      }),
      doSuspendTurn: async () => continueState,
    };
    const harness: HarnessV1 = {
      specificationVersion: 'harness-v1',
      harnessId: 'mock',
      builtinTools: {},
      lifecycleStateSchema: z.object({ value: z.string() }),
      doStart: async () => underlying,
    };

    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    const session = await agent.createSession();
    await expect(session.stop()).resolves.toEqual(resumeState);
    expect(doStop).toHaveBeenCalledTimes(1);
    expect(doDestroy).not.toHaveBeenCalled();
    await expect(
      agent.generate({ session, prompt: 'after stop' }),
    ).rejects.toThrow(/has ended/);
  });
});
