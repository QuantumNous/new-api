import { createMCPClient, mcpAppClientCapabilities } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export function createLocalMCPAppsClient(origin: string) {
  return createMCPClient({
    transport: new StreamableHTTPClientTransport(
      new URL('/chat/mcp-apps/server', origin),
    ),
    clientName: 'local-mcp-apps',
    capabilities: mcpAppClientCapabilities,
  });
}
