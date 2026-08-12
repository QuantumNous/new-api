import { createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {
  const client = await createMCPClient({
    transport: new StreamableHTTPClientTransport(
      new URL('http://localhost:3000/mcp'),
    ),
  });

  console.log('serverInfo:', client.serverInfo);
  console.log('instructions:', client.instructions);

  await client.close();
}

main().catch(console.error);
