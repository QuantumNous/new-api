import { openai } from '@ai-sdk/openai';
import { Sandbox } from '@vercel/sandbox';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
import { readFileSync } from 'fs';
import { join } from 'path';

const skillPath = '/vercel/sandbox/skills/island-rescue';
const skillMd = readFileSync(
  join(process.cwd(), 'data', 'island-rescue', 'SKILL.md'),
);

let globalSandboxName: string | null = null;
async function getSandbox(): Promise<Sandbox> {
  if (globalSandboxName) {
    return await Sandbox.get({ name: globalSandboxName });
  }
  const sandbox = await Sandbox.create();
  globalSandboxName = sandbox.name;

  await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', skillPath] });
  await sandbox.writeFiles([
    { path: `${skillPath}/SKILL.md`, content: skillMd },
  ]);

  return sandbox;
}

async function executeShellCommand({
  command,
  timeoutMs,
}: {
  command: string;
  timeoutMs?: number;
}): Promise<{
  stdout: string;
  stderr: string;
  outcome: { type: 'timeout' } | { type: 'exit'; exitCode: number };
}> {
  const sandbox = await getSandbox();
  const timeout = timeoutMs ?? 60_000;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Command timeout')), timeout);
    });

    const commandPromise = sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', command],
    });

    const commandResult = await Promise.race([commandPromise, timeoutPromise]);

    const stdout = await commandResult.stdout();
    const stderr = await commandResult.stderr();
    const exitCode = commandResult.exitCode ?? 0;

    return {
      stdout: stdout || '',
      stderr: stderr || '',
      outcome: { type: 'exit', exitCode },
    };
  } catch (error: any) {
    const timedOut = error?.message?.includes('timeout') || false;
    const exitCode = timedOut ? null : (error?.code ?? 1);

    return {
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? String(error),
      outcome: timedOut
        ? { type: 'timeout' }
        : { type: 'exit', exitCode: exitCode ?? 1 },
    };
  }
}

export const openaiShellSkillsAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.6'),
  instructions:
    'You have access to a shell tool that can execute commands on the local filesystem. ' +
    'You also have access to skills installed locally. ' +
    'Use the shell tool when you need to perform file operations or run commands. ' +
    'When a tool execution is not approved by the user, do not retry it. ' +
    'Just say that the tool execution was not approved.',
  tools: {
    shell: openai.tools.shell({
      needsApproval: true,
      async execute({ action }) {
        const outputs = await Promise.all(
          action.commands.map(command =>
            executeShellCommand({
              command,
              timeoutMs: action.timeoutMs,
            }),
          ),
        );

        return { output: outputs };
      },
      environment: {
        type: 'local',
        skills: [
          {
            name: 'island-rescue',
            description: 'How to be rescued from a lonely island',
            path: skillPath,
          },
        ],
      },
    }),
  },
});

export type OpenAIShellSkillsMessage = InferAgentUIMessage<
  typeof openaiShellSkillsAgent
>;
