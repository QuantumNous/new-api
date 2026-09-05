import type { Telemetry } from 'ai';
import { describe, expect, test } from 'vitest';
import type {
  HarnessV1,
  HarnessV1NetworkSandboxSession,
  HarnessV1PromptControl,
  HarnessV1PromptTurnOptions,
  HarnessV1SandboxProvider,
  HarnessV1Session,
  HarnessV1StreamPart,
} from '../v1';
import { HarnessAgent } from './harness-agent';

const usage = {
  inputTokens: {
    total: 5,
    noCache: 5,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

function scriptedHarness(script: HarnessV1StreamPart[]): HarnessV1 {
  const session: HarnessV1Session = {
    sessionId: 'tel-session',
    isResume: false,
    doPromptTurn: async (opts: HarnessV1PromptTurnOptions) => {
      const control: HarnessV1PromptControl = {
        submitToolResult: async () => {},
        done: Promise.resolve(),
      };
      queueMicrotask(() => {
        for (const event of script) opts.emit(event);
      });
      return control;
    },
    doCompact: async () => {},
    doContinueTurn: async () => ({
      submitToolResult: async () => {},
      done: Promise.resolve(),
    }),
    doDetach: async () => ({
      type: 'resume-session',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: {},
    }),
    doStop: async () => ({
      type: 'resume-session',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: {},
    }),
    doDestroy: async () => {},
    doSuspendTurn: async () => ({
      type: 'continue-turn',
      harnessId: 'mock',
      specificationVersion: 'harness-v1',
      data: {},
    }),
  };
  return {
    specificationVersion: 'harness-v1',
    harnessId: 'mock',
    builtinTools: {},
    doStart: async () => session,
  };
}

function makeSandboxProvider(): HarnessV1SandboxProvider {
  const sandboxSession = {
    id: 'sandbox',
    defaultWorkingDirectory: '/work',
    ports: [],
    getPortUrl: async () => 'ws://example.test/',
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    stop: async () => {},
    destroy: async () => {},
    restricted: () => ({}),
  } as unknown as HarnessV1NetworkSandboxSession;
  return {
    specificationVersion: 'harness-sandbox-v1',
    providerId: 'mock-sandbox',
    createSession: async () => sandboxSession,
  };
}

/** A telemetry integration that records the lifecycle methods it receives. */
function recordingIntegration(): {
  integration: Telemetry;
  calls: Array<{ method: string; callId: unknown }>;
  events: Record<string, unknown>;
} {
  const calls: Array<{ method: string; callId: unknown }> = [];
  const events: Record<string, unknown> = {};
  const rec =
    (method: string) =>
    (event: unknown): void => {
      calls.push({ method, callId: (event as { callId?: unknown }).callId });
      events[method] = event;
    };
  return {
    calls,
    events,
    integration: {
      onStart: rec('onStart'),
      onStepStart: rec('onStepStart'),
      onLanguageModelCallStart: rec('onLanguageModelCallStart'),
      onLanguageModelCallEnd: rec('onLanguageModelCallEnd'),
      onToolExecutionStart: rec('onToolExecutionStart'),
      onToolExecutionEnd: rec('onToolExecutionEnd'),
      onStepFinish: rec('onStepFinish'),
      onEnd: rec('onEnd'),
    },
  };
}

describe('HarnessAgent telemetry integration', () => {
  test('drives the Telemetry lifecycle from the turn stream', async () => {
    const harness = scriptedHarness([
      { type: 'stream-start' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'hi' },
      { type: 'text-end', id: 't1' },
      {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'bash',
        input: '{"command":"ls"}',
        providerExecuted: true,
      },
      {
        type: 'tool-result',
        toolCallId: 'c1',
        toolName: 'bash',
        result: { output: 'ok' },
      },
      {
        type: 'finish-step',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        totalUsage: usage,
      },
    ]);

    const { integration, calls, events } = recordingIntegration();
    const agent = new HarnessAgent({
      harness,
      sandbox: makeSandboxProvider(),
      telemetry: { integrations: [integration] },
    });
    const session = await agent.createSession();
    await agent.generate({ session, prompt: 'go' });
    await session.destroy();

    expect(calls.map(c => c.method)).toEqual([
      'onStart',
      'onStepStart',
      'onLanguageModelCallStart',
      'onToolExecutionStart',
      'onToolExecutionEnd',
      'onLanguageModelCallEnd',
      'onStepFinish',
      'onEnd',
    ]);

    // The model's output content reaches the inference-call end (gen_ai output
    // messages): the streamed text and the tool-call, captured non-lossily.
    const lmEnd = events.onLanguageModelCallEnd as { content: unknown[] };
    expect(lmEnd.content).toEqual([
      { type: 'text', text: 'hi' },
      {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'bash',
        input: '{"command":"ls"}',
      },
    ]);
    // The input prompt is on the operation start (gen_ai input messages).
    const start = events.onStart as { messages: unknown[] };
    expect(start.messages).toEqual([{ role: 'user', content: 'go' }]);
    // Every lifecycle event shares one correlating callId.
    const callIds = new Set(calls.map(c => c.callId));
    expect(callIds.size).toBe(1);
    expect([...callIds][0]).toBeTruthy();
  });

  test('fires no telemetry when settings.telemetry is unset', async () => {
    const harness = scriptedHarness([
      { type: 'stream-start' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        totalUsage: usage,
      },
    ]);
    const { integration, calls } = recordingIntegration();
    // Integration registered, but the agent has no telemetry settings → opt-out.
    const agent = new HarnessAgent({ harness, sandbox: makeSandboxProvider() });
    void integration;
    const session = await agent.createSession();
    await agent.generate({ session, prompt: 'go' });
    await session.destroy();
    expect(calls).toEqual([]);
  });
});
