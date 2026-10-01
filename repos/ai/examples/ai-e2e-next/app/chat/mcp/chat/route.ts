import { openai } from '@ai-sdk/openai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';

export async function POST(req: Request) {
  const requestUrl = new URL(req.url);
  const url = new URL('/chat/mcp/server', requestUrl.origin);
  const transport = new StreamableHTTPClientTransport(url);

  const [client, { messages }] = await Promise.all([
    createMCPClient({
      transport,
      clientName: 'local-calculator-mcp',
    }),
    req.json(),
  ]);

  try {
    const tools = await client.tools();

    const result = streamText({
      model: openai('gpt-4o-mini'),
      tools,
      stopWhen: isStepCount(5),
      onStepFinish: async ({ toolResults }) => {
        console.log(`STEP RESULTS: ${JSON.stringify(toolResults, null, 2)}`);
      },
      instructions:
        'You are a helpful chatbot capable of basic arithmetic problems',
      messages: await convertToModelMessages(messages),
      onEnd: async () => {
        await client.close();
      },
      // Optional, enables immediate clean up of resources but connection will not be retained for retries:
      // onError: async error => {
      //   await client.close();
      // },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
