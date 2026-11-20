import { createAgentUIStreamResponse } from 'ai';
import { azureImageGenerationAgent } from '@/agent/azure/image-generation-agent';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: azureImageGenerationAgent,
    uiMessages: body.messages,
  });
}
