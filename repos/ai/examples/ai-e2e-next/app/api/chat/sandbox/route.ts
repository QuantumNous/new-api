import {
  sandboxAgent,
  type SandboxAgentUIMessage,
} from '@/agent/openai/sandbox-agent';
import { createAgentUIStreamResponse } from 'ai';
import { Sandbox } from '@vercel/sandbox';
import { VercelSandboxSession } from '@/sandbox/vercel-sandbox';

async function getSandbox(sandboxName?: string) {
  if (sandboxName != null) {
    try {
      const sandbox = await Sandbox.get({ name: sandboxName });
      if (sandbox.status !== 'stopped' && sandbox.status !== 'failed') {
        return sandbox;
      }
    } catch {
      // If the previous sandbox is gone, fall through and create a new one.
    }
  }

  return Sandbox.create({ timeout: 60_000 * 3 });
}

function getLatestSandboxName(messages: SandboxAgentUIMessage[]) {
  return messages.findLast(message => message.metadata?.sandboxName)?.metadata
    ?.sandboxName;
}

export async function POST(req: Request) {
  const { messages }: { messages: SandboxAgentUIMessage[] } = await req.json();

  const vercelSandbox = await getSandbox(getLatestSandboxName(messages));

  const sandbox = new VercelSandboxSession(vercelSandbox);

  return createAgentUIStreamResponse({
    agent: sandboxAgent,
    uiMessages: messages,
    originalMessages: messages,
    experimental_sandbox: sandbox,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { sandboxName: vercelSandbox.name };
      }
    },
  });
}
