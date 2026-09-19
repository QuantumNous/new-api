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

export const openaiLocalShellAgent = new ToolLoopAgent({
  model: openai('gpt-5-codex'),
  instructions:
    'You are an agent with access to a shell environment.' +
    'When a command execution is denied, ask the user if they want to execute something else.',
  tools: {
    shell: openai.tools.localShell({
      needsApproval({ action }) {
        // allow only `ls` to be executed without approval
        return action.command.join(' ') !== 'ls';
      },
      async execute({ action }) {
        const [cmd, ...args] = action.command;

        const sandbox = await getSandbox();
        const command = await sandbox.runCommand({
          cmd,
          args,
          cwd: action.workingDirectory,
        });

        return { output: await command.stdout() };
      },
    }),
  },
});

export type OpenAILocalShellMessage = InferAgentUIMessage<
  typeof openaiLocalShellAgent
>;
