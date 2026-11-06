/**
 * Runnable end-to-end demo of `@ai-sdk/policy-opa` with the AI SDK's mock model.
 *
 * Run from the package directory:
 *   pnpm tsx examples/mock/basic.ts
 *
 * Demonstrates three things in one script:
 *
 *   1. Allow path: the policy returns `allow`, `tool.execute` runs, the model
 *      sees the tool result.
 *   2. Deny path: the policy returns `deny` with a reason; `tool.execute` is
 *      never called, the model receives an `execution-denied` tool-result.
 *   3. Transitive enforcement: a `bash` dispatcher's `toolApproval` rewrites
 *      `bash 'git push'` into `(kind: 'git', args: ['push'])` and asks the
 *      same Rego rule that gates the direct `git` tool, so the deny fires
 *      regardless of which surface the model used.
 *
 * To swap the mock for a real provider, replace the `MockLanguageModelV3`
 * construction with one line, e.g. `model: anthropic('claude-sonnet-4-5')`.
 * Everything else (tools, toolApproval, policy) is provider-agnostic.
 */
import { jsonSchema } from '@ai-sdk/provider-utils';
import { generateText, isStepCount, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { PolicyClient } from '../../src/policy-client';
import { opaPolicy } from '../../src/opa/opa-policy';

const dummyUsage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
} as const;

function mockModel(toolName: string, input: string): MockLanguageModelV3 {
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
                toolName,
                input,
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

function stubClient(decision: unknown): PolicyClient {
  return {
    async evaluate() {
      return decision as never;
    },
  };
}

const gitTool = tool({
  description: 'Run a git subcommand',
  inputSchema: jsonSchema<{ args: string[] }>({
    type: 'object',
    properties: { args: { type: 'array', items: { type: 'string' } } },
    required: ['args'],
  }),
  execute: async ({ args }) => `git ${args.join(' ')}: ok`,
});

const bashTool = tool({
  description: 'Run a shell command',
  inputSchema: jsonSchema<{ cmd: string }>({
    type: 'object',
    properties: { cmd: { type: 'string' } },
    required: ['cmd'],
  }),
  execute: async ({ cmd }) => `bash> ${cmd}: ok`,
});

function printResult(label: string, result: { responseMessages: unknown }) {
  // Compact, scannable per-run report.
  const messages = result.responseMessages as Array<{
    role: string;
    content: Array<Record<string, unknown>>;
  }>;
  // biome-ignore lint/suspicious/noConsole: example output is the whole point
  console.log(`\n=== ${label} ===`);
  for (const m of messages) {
    for (const c of m.content) {
      // biome-ignore lint/suspicious/noConsole: example output is the whole point
      console.log(`[${m.role}] ${c.type}`, summarize(c));
    }
  }
}

function summarize(c: Record<string, unknown>): string {
  if (c.type === 'tool-call') {
    return `${c.toolName as string}(${JSON.stringify(c.input)})`;
  }
  if (c.type === 'tool-result') {
    const out = c.output as { type: string; reason?: string } | string;
    return typeof out === 'string' ? out : `${out.type}: ${out.reason ?? ''}`;
  }
  if (c.type === 'tool-approval-response') {
    return `approved=${c.approved as boolean} reason=${c.reason as string | undefined}`;
  }
  if (c.type === 'text') return JSON.stringify(c.text);
  return '';
}

async function main() {
  // 1. Allow path.
  const allow = await generateText({
    model: mockModel('git', `{ "args": ["status"] }`),
    prompt: 'check the repo',
    stopWhen: isStepCount(3),
    tools: { git: gitTool },
    toolApproval: opaPolicy({
      client: stubClient({ decision: 'allow' }),
      path: 'agent/call/decision',
    }),
  });
  printResult('1. allow: git status', allow);

  // 2. Direct deny.
  const deny = await generateText({
    model: mockModel('git', `{ "args": ["push"] }`),
    prompt: 'push my changes',
    stopWhen: isStepCount(3),
    tools: { git: gitTool },
    toolApproval: opaPolicy({
      client: stubClient({
        decision: 'deny',
        reason: 'pushes require human review',
      }),
      path: 'agent/call/decision',
    }),
  });
  printResult('2. deny: git push', deny);

  // 3. Transitive deny via bash dispatcher.
  const evaluate: PolicyClient['evaluate'] = async (_path, input) => {
    const i = input as { kind: string; args: string[] };
    return (
      i.kind === 'git' && i.args[0] === 'push'
        ? { decision: 'deny', reason: 'pushes denied (caught via bash)' }
        : { decision: 'allow' }
    ) as never;
  };

  const transitive = await generateText({
    model: mockModel('bash', `{ "cmd": "git push origin main" }`),
    prompt: 'shell out',
    stopWhen: isStepCount(3),
    tools: { bash: bashTool },
    toolApproval: opaPolicy({
      client: { evaluate },
      path: 'agent/action/decision',
      toInput: ({ toolCall }) => {
        const cmd = (toolCall.input as { cmd: string }).cmd;
        const [bin, ...args] = cmd.split(/\s+/);
        return { kind: bin, args };
      },
    }),
  });
  printResult('3. transitive deny: bash "git push origin main"', transitive);
}

main().catch(err => {
  // biome-ignore lint/suspicious/noConsole: example output is the whole point
  console.error(err);
  process.exit(1);
});
