import { openaiImageGenerationCustomToolAgent } from '@/agent/openai/image-generation-custom-tool-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();

  console.dir(body.messages, { depth: Infinity });

  return createAgentUIStreamResponse({
    agent: openaiImageGenerationCustomToolAgent,
    uiMessages: body.messages,
  });
}
