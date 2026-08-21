/**
 * End-to-end check that the `toolApproval` wired by `opaPolicy` reaches
 * `generateText` and actually gates tool execution. Unit tests of the
 * adapter functions alone can pass while the SDK wiring is broken, so this
 * suite drives the full path: mock model emits a tool call, the policy
 * decides, `generateText` either runs `tool.execute` or returns an
 * execution-denied result.
 */
import { jsonSchema } from '@ai-sdk/provider-utils';
import { generateText, isStepCount, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import type { PolicyClient } from '../policy-client';
import { opaPolicy } from './opa-policy';
import { stubClient } from './test-helpers';

const dummyUsage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
} as const;

function modelEmittingOneToolCallThenText() {
  let step = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      switch (step++) {
        case 0:
          return {
            warnings: [],
            usage: dummyUsage,
            finishReason: { unified: 'tool-calls', raw: undefined },
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'git',
                input: `{ "args": ["push"] }`,
              },
            ],
          };
        default:
          return {
            warnings: [],
            usage: dummyUsage,
            finishReason: { unified: 'stop', raw: 'stop' },
            content: [{ type: 'text', text: 'understood, stopping.' }],
          };
      }
    },
  });
}

describe('opaPolicy end-to-end with generateText', () => {
  it('executes the tool when the policy says allow', async () => {
    const execute = vi.fn(async () => 'ok');

    const result = await generateText({
      model: modelEmittingOneToolCallThenText(),
      prompt: 'do something',
      stopWhen: isStepCount(3),
      tools: {
        git: tool({
          inputSchema: jsonSchema<{ args: string[] }>({
            type: 'object',
            properties: { args: { type: 'array', items: { type: 'string' } } },
            required: ['args'],
          }),
          execute,
        }),
      },
      toolApproval: opaPolicy({
        client: stubClient({ decision: 'allow' }),
        path: 'agent/call/decision',
      }),
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].output).toBe('ok');
  });

  it('skips execution and surfaces the deny reason when the policy says deny', async () => {
    const execute = vi.fn(async () => 'ok');

    const result = await generateText({
      model: modelEmittingOneToolCallThenText(),
      prompt: 'do something',
      stopWhen: isStepCount(3),
      tools: {
        git: tool({
          inputSchema: jsonSchema<{ args: string[] }>({
            type: 'object',
            properties: { args: { type: 'array', items: { type: 'string' } } },
            required: ['args'],
          }),
          execute,
        }),
      },
      toolApproval: opaPolicy({
        client: stubClient({
          decision: 'deny',
          reason: 'pushes require human review',
        }),
        path: 'agent/call/decision',
      }),
    });

    expect(execute).not.toHaveBeenCalled();
    // The tool-role message carries an auto-emitted approval-response with
    // approved: false, followed by a tool-result with type execution-denied
    // that the model receives on its next step.
    const toolMessage = result.responseMessages.find(m => m.role === 'tool') as
      | {
          content: Array<{
            type: string;
            approved?: boolean;
            reason?: string;
            output?: { type: string; reason?: string };
          }>;
        }
      | undefined;
    expect(toolMessage).toBeDefined();

    const approvalResponse = toolMessage!.content.find(
      c => c.type === 'tool-approval-response',
    );
    expect(approvalResponse).toMatchObject({
      approved: false,
      reason: 'pushes require human review',
    });

    const toolResult = toolMessage!.content.find(c => c.type === 'tool-result');
    expect(toolResult?.output).toMatchObject({
      type: 'execution-denied',
      reason: 'pushes require human review',
    });
  });

  it('routes a dispatcher call through the same Rego rule via toInput', async () => {
    // Demonstrates the transitive-enforcement pattern documented in the
    // README: bash `'git push'` is rewritten to (kind: 'git', args: ['push'])
    // before reaching the OPA rule, so the same policy fires regardless of
    // whether the model called git directly or routed through bash.
    const evaluate = vi.fn(async (_path: string, input: unknown) => {
      const i = input as { kind: string; args: string[] };
      return i.kind === 'git' && i.args[0] === 'push'
        ? { decision: 'deny', reason: 'pushes denied' }
        : { decision: 'allow' };
    });

    const bashExecute = vi.fn(async () => 'never runs');

    let step = 0;
    const result = await generateText({
      model: new MockLanguageModelV3({
        doGenerate: async () => {
          switch (step++) {
            case 0:
              return {
                warnings: [],
                usage: dummyUsage,
                finishReason: { unified: 'tool-calls', raw: undefined },
                content: [
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'bash',
                    input: `{ "cmd": "git push origin main" }`,
                  },
                ],
              };
            default:
              return {
                warnings: [],
                usage: dummyUsage,
                finishReason: { unified: 'stop', raw: 'stop' },
                content: [{ type: 'text', text: 'ok' }],
              };
          }
        },
      }),
      prompt: 'do something',
      stopWhen: isStepCount(3),
      tools: {
        bash: tool({
          inputSchema: jsonSchema<{ cmd: string }>({
            type: 'object',
            properties: { cmd: { type: 'string' } },
            required: ['cmd'],
          }),
          execute: bashExecute,
        }),
      },
      toolApproval: opaPolicy({
        client: { evaluate: evaluate as never },
        path: 'agent/action/decision',
        toInput: ({ toolCall }) => {
          const cmd = (toolCall.input as { cmd: string }).cmd;
          const [bin, ...args] = cmd.split(/\s+/);
          return { kind: bin, args };
        },
      }),
    });

    expect(evaluate).toHaveBeenCalledWith('agent/action/decision', {
      kind: 'git',
      args: ['push', 'origin', 'main'],
    });
    expect(bashExecute).not.toHaveBeenCalled();

    const toolMessage = result.responseMessages.find(m => m.role === 'tool') as
      | {
          content: Array<{
            type: string;
            output?: { type: string; reason?: string };
          }>;
        }
      | undefined;
    const toolResult = toolMessage?.content.find(c => c.type === 'tool-result');
    expect(toolResult?.output).toMatchObject({
      type: 'execution-denied',
      reason: 'pushes denied',
    });
  });

  it('fails closed when the backend errors: generation completes, tool is denied', async () => {
    const execute = vi.fn(async () => 'ok');
    const failing: PolicyClient = {
      async evaluate() {
        throw new Error('OPA unreachable');
      },
    };

    const result = await generateText({
      model: modelEmittingOneToolCallThenText(),
      prompt: 'do something',
      stopWhen: isStepCount(3),
      tools: {
        git: tool({
          inputSchema: jsonSchema<{ args: string[] }>({
            type: 'object',
            properties: { args: { type: 'array', items: { type: 'string' } } },
            required: ['args'],
          }),
          execute,
        }),
      },
      toolApproval: opaPolicy({ client: failing, path: 'agent/call/decision' }),
    });

    // The run completes (no abort) and the tool never executed.
    expect(execute).not.toHaveBeenCalled();
    const toolMessage = result.responseMessages.find(m => m.role === 'tool') as
      | { content: Array<{ type: string; output?: { type: string } }> }
      | undefined;
    const toolResult = toolMessage?.content.find(c => c.type === 'tool-result');
    expect(toolResult?.output).toMatchObject({ type: 'execution-denied' });
  });
});
