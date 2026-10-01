import { mcpApiHandler } from '@/util/mcp/handler';
import type { NextRequest } from 'next/server';

// This route (/chat/mcp/server) serves the MCP server; it's called by the /mcp/chat route that's used by useChat to connect to the server and fetch tools:
const requestHandler = (req: NextRequest) => {
  return mcpApiHandler(req);
};

export {
  requestHandler as DELETE,
  requestHandler as GET,
  requestHandler as POST,
};
