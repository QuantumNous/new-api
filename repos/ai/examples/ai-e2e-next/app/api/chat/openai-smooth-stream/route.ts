import { openaiBasicAgent } from '@/agent/openai/basic-agent';
import { createAgentUIStreamResponse, smoothStream } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiBasicAgent,
    uiMessages: body.messages,
    experimental_transform: smoothStream(),
  });
}
