import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const mcpClient = await createMCPClient({
    transport: {
      type: 'http',
      url: 'https://mcp.zapier.com/api/mcp/s/[YOUR_SERVER_ID]/mcp',
    },
  });

  try {
    const zapierTools = await mcpClient.tools();

    const result = streamText({
      model: openai('gpt-4o'),
      messages: await convertToModelMessages(messages),
      tools: zapierTools,
      onEnd: async () => {
        await mcpClient.close();
      },
      stopWhen: isStepCount(10),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
