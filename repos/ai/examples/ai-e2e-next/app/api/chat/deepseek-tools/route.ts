import { deepseekToolsAgent } from '@/agent/deepseek/tools-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();

  return createAgentUIStreamResponse({
    agent: deepseekToolsAgent,
    uiMessages: body.messages,
  });
}
