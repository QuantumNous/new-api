import { openaiWebSearchAgent } from '@/agent/openai/web-search-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiWebSearchAgent,
    uiMessages: body.messages,
    sendSources: true,
  });
}
