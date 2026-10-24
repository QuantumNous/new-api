import { openai } from '@ai-sdk/openai';
import {
  createMCPClient,
  type MCPClient,
  type McpProviderMetadata,
} from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateText } from 'ai';
import 'dotenv/config';

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost:8085/mcp'),
  );

  const mcpClient: MCPClient = await createMCPClient({
    transport,
    clientName: 'provider-metadata-example-client',
  });

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      tools: await mcpClient.tools(),
      toolChoice: {
        type: 'tool',
        toolName: 'lookup-order',
      },
      prompt: 'Look up order order_123 and summarize its status.',
    });

    for (const toolCall of result.toolCalls) {
      const mcpMetadata = toolCall.toolMetadata as
        | McpProviderMetadata
        | undefined;

      if (mcpMetadata == null) {
        continue;
      }

      console.log('MCP provider metadata:');
      console.log(`  Client name: ${mcpMetadata.clientName}`);
      console.log(`  Tool name: ${mcpMetadata.toolName}`);
      console.log(`  Title: ${mcpMetadata.title ?? '(none)'}`);
    }

    console.log(`\nFINAL ANSWER: ${result.text}`);
  } finally {
    await mcpClient.close();
  }
}

main().catch(console.error);
