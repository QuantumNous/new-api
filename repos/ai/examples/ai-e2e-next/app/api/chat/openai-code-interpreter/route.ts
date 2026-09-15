import { createAgentUIStreamResponse } from 'ai';
import { openaiCodeInterpreterAgent } from '@/agent/openai/code-interpreter-agent';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiCodeInterpreterAgent,
    uiMessages: body.messages,
  });
}
