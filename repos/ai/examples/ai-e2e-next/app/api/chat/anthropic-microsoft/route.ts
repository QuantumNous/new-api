import { createAgentUIStreamResponse } from 'ai';
import { createAnthropicMicrosoftAgent } from '@/agent/anthropic/microsoft-agent';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: createAnthropicMicrosoftAgent(),
    uiMessages: body.messages,
    sendSources: true,
  });
}
