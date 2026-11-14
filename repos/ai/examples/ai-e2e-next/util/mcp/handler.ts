import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

export const mcpApiHandler = initializeMcpApiHandler({
  initializationCallback: server => {
    server.tool(
      'calculateSum',
      'Returns the sum of N numbers',
      {
        values: z.array(z.number()),
      },
      { title: '🔢 Calculator' },
      async ({ values }: { values: number[] }) => ({
        content: [
          {
            type: 'text',
            text: `Sum: ${values.reduce((a: number, b: number) => a + b, 0)}`,
          },
        ],
      }),
    );
  },
  serverOptions: {
    capabilities: {
      tools: {},
    },
  },
});

function initializeMcpApiHandler({
  initializationCallback,
  serverOptions,
}: {
  initializationCallback: (server: McpServer) => void;
  serverOptions?: ServerOptions;
}) {
  return async function mcpApiHandler(req: NextRequest) {
    const url = new URL(req.url || '', 'https://example.com');

    if (url.pathname === '/chat/mcp/server') {
      if (req.method === 'GET') {
        console.log('Received GET MCP request');
        return Response.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Method not allowed.',
            },
            id: null,
          },
          { status: 405 },
        );
      }

      if (req.method === 'DELETE') {
        console.log('Received DELETE MCP request');
        return Response.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Method not allowed.',
            },
            id: null,
          },
          { status: 405 },
        );
      }

      console.log('New MCP connection', req.url, req.method);

      if (req.method === 'POST') {
        /**
         * In Stateless Mode, we create a new instance of transport and server for each request to ensure complete isolation. A single instance would cause request ID collisions when multiple clients connect concurrently.
         */
        const server = new McpServer(
          {
            name: 'MCP Next.js Server',
            version: '0.1.0',
          },
          serverOptions,
        );
        const statelessTransport = new WebStandardStreamableHTTPServerTransport(
          {
            sessionIdGenerator: undefined,
          },
        );
        initializationCallback(server);
        await server.connect(statelessTransport);

        return statelessTransport.handleRequest(req);
      }
    } else {
      return new Response('Not found', { status: 404 });
    }

    return new Response('Method not allowed', { status: 405 });
  };
}
