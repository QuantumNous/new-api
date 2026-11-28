import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

// Stateless Mode: see https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/examples#stateless-mode for more details

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const server = new McpServer({
    name: 'example-http-server',
    version: '1.0.0',
  });

  server.tool(
    'get-user-info',
    'Get user info',
    {
      userId: z.string(),
    },
    async ({ userId }) => {
      return {
        content: [
          {
            type: 'text',
            text: `Here is information about user ${userId}:`,
          },
          {
            type: 'text',
            text: `Name: John Doe`,
          },
          {
            type: 'text',
            text: `Email: john.doe@example.com`,
          },
          {
            type: 'text',
            text: `Age: 30`,
          },
        ],
      };
    },
  );

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get('/mcp', async (_req, res) => {
  console.log('Received GET MCP request');
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }),
  );
});

app.delete('/mcp', async (_req, res) => {
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }),
  );
});

app.listen(3000);

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
