import { openai } from '@ai-sdk/openai';
import { Sandbox } from '@vercel/sandbox';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
// warning: this is a demo sandbox that is shared across chats on localhost
let globalSandboxName: string | null = null;
async function getSandbox(): Promise<Sandbox> {
  if (globalSandboxName) {
    return await Sandbox.get({ name: globalSandboxName });
  }
  const sandbox = await Sandbox.create();
  globalSandboxName = sandbox.name;
  return sandbox;
}

async function executeShellCommand(
  command: string,
  timeoutMs?: number,
): Promise<{
  stdout: string;
  stderr: string;
  outcome: { type: 'timeout' } | { type: 'exit'; exitCode: number };
}> {
  const sandbox = await getSandbox();
  const timeout = timeoutMs ?? 60_000; // Default 60 seconds

  try {
    // Use Promise.race to handle timeout
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
    // Handle timeout or other errors
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

export const openaiShellAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.6'),
  instructions:
    'You have access to a shell tool that can execute commands on the local filesystem. ' +
    'Use the shell tool when you need to perform file operations or run commands. ' +
    'When a tool execution is not approved by the user, do not retry it. ' +
    'Just say that the tool execution was not approved.',
  tools: {
    shell: openai.tools.shell({
      needsApproval: true,
      async execute({ action }) {
        const outputs = await Promise.all(
          action.commands.map(command =>
            executeShellCommand(command, action.timeoutMs),
          ),
        );

        return { output: outputs };
      },
    }),
  },
});

export type OpenAIShellMessage = InferAgentUIMessage<typeof openaiShellAgent>;
