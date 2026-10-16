/**
 * Runnable demo: gate `git` run inside `bash` (vercel-labs/bash-tool) with the
 * read-only-git policy in ./policy.rego.
 *
 * Prereqs (the OPA HTTP backend is an optional peer dep, and you need a running
 * OPA server pointed at this directory's policy):
 *
 *   pnpm add @open-policy-agent/opa
 *   opa run --server --addr :8181 packages/policy-opa/examples/git-in-bash
 *   pnpm tsx packages/policy-opa/examples/git-in-bash/git-in-bash.ts
 *
 * The same policy governs a granular `git` tool and a coarse `bash` tool: both
 * route through `agent/action/decision`, varying only in how `toInput` derives
 * the logical action. Swap the mock model for a real provider in one line.
 */
import { jsonSchema } from '@ai-sdk/provider-utils';
import { generateText, isStepCount, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { httpPolicyClient } from '../../src/opa/http-policy-client';
import { opaPolicy } from '../../src/opa/opa-policy';
import { bashCommandToInput } from './parse-git-invocation';

const dummyUsage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
} as const;

function mockModelCalling(
  toolName: string,
  input: string,
): MockLanguageModelV3 {
  let step = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      if (step++ === 0) {
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
      }
      return {
        warnings: [],
        usage: dummyUsage,
        finishReason: { unified: 'stop', raw: 'stop' },
        content: [{ type: 'text', text: 'done.' }],
      };
    },
  });
}

const client = httpPolicyClient({ url: 'http://localhost:8181' });

const bash = tool({
  description: 'Run a shell command',
  inputSchema: jsonSchema<{ command: string }>({
    type: 'object',
    properties: { command: { type: 'string' } },
    required: ['command'],
  }),
  execute: async ({ command }) => `ran: ${command}`,
});

const git = tool({
  description: 'Run a git subcommand',
  inputSchema: jsonSchema<{ args: string[] }>({
    type: 'object',
    properties: { args: { type: 'array', items: { type: 'string' } } },
    required: ['args'],
  }),
  execute: async ({ args }) => `git ${args.join(' ')}: ok`,
});

// One rule, two surfaces. The bash dispatcher reduces `{ command }` to the
// logical action; the granular git tool reduces `{ args }` the same way.
const bashApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) =>
    bashCommandToInput((toolCall.input as { command: string }).command),
});

const gitApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const args = (toolCall.input as { args: string[] }).args;
    return { kind: 'git', subcommand: args[0], args: args.slice(1) };
  },
});

async function runBash(label: string, command: string) {
  const result = await generateText({
    model: mockModelCalling('bash', JSON.stringify({ command })),
    prompt: label,
    stopWhen: isStepCount(3),
    tools: { bash },
    toolApproval: bashApproval,
  });
  report(`bash: ${command}`, result);
}

async function runGit(label: string, args: string[]) {
  const result = await generateText({
    model: mockModelCalling('git', JSON.stringify({ args })),
    prompt: label,
    stopWhen: isStepCount(3),
    tools: { git },
    toolApproval: gitApproval,
  });
  report(`git ${args.join(' ')}`, result);
}

function report(label: string, result: { responseMessages: unknown }) {
  const messages = result.responseMessages as Array<{
    role: string;
    content: Array<Record<string, unknown>>;
  }>;
  const toolResult = messages
    .flatMap(m => m.content)
    .find(c => c.type === 'tool-result');
  const output = toolResult?.output as
    | { type: string; reason?: string }
    | string
    | undefined;
  let verdict: string;
  if (typeof output === 'string') {
    verdict = `allowed → ${output}`;
  } else if (output?.type === 'execution-denied') {
    verdict = `DENIED → ${output.reason ?? ''}`;
  } else {
    verdict = 'no tool result';
  }
  // biome-ignore lint/suspicious/noConsole: example output is the whole point
  console.log(`${label.padEnd(40)} ${verdict}`);
}

async function main() {
  await runBash('read the status', 'git status');
  await runBash('look at history', 'git log --oneline');
  await runBash('list remotes', 'git remote -v');
  await runBash('clone a repo', 'git clone https://example.com/x.git');
  await runBash(
    'sneak a clone',
    'cd /tmp && git clone https://example.com/x.git',
  );
  await runGit('direct git status', ['status']);
  await runGit('direct git clone', ['clone', 'https://example.com/x.git']);
}

main().catch(err => {
  // biome-ignore lint/suspicious/noConsole: example output is the whole point
  console.error(err);
  process.exit(1);
});
