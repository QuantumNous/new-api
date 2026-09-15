import { openaiShellContainerAgent } from '@/agent/openai/shell-container-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiShellContainerAgent,
    uiMessages: body.messages,
  });
}
