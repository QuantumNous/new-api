import { createAgentUIStreamResponse } from 'ai';
import { openaiImageGenerationAgent } from '@/agent/openai/image-generation-agent';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiImageGenerationAgent,
    uiMessages: body.messages,
  });
}
