import { openaiLocalShellAgent } from '@/agent/openai/local-shell-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiLocalShellAgent,
    uiMessages: body.messages,
  });
}
