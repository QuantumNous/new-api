import { openai } from '@ai-sdk/openai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { streamText } from 'ai';
import 'dotenv/config';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL('https://cowboy.com/api/mcp'),
  );

  const mcpClient: MCPClient = await createMCPClient({
    transport: {
      type: 'http',
      url: 'https://cowboy.com/api/mcp',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  });

  try {
    const tools = await mcpClient.tools();

    const result = streamText({
      model: openai('gpt-4o-mini'),
      tools,
      instructions: 'You are a helpful chatbot',
      prompt: 'What tools are available for me to call?',
      onEnd: async () => {
        await mcpClient.close();
      },
    });

    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log();
  } catch (error) {
    console.error('Error:', error);
    await mcpClient.close();
  }
}

main();
