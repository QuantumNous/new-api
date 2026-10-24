import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const server = new McpServer({
    name: 'provider-metadata-example-server',
    version: '1.0.0',
  });

  server.registerTool(
    'lookup-order',
    {
      title: 'Lookup Order',
      description: 'Look up the status of a customer order.',
      inputSchema: {
        orderId: z.string().describe('The order ID to look up.'),
      },
    },
    async ({ orderId }) => ({
      content: [
        {
          type: 'text',
          text: `Order ${orderId} is packed and ready to ship.`,
        },
      ],
    }),
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

app.listen(8085, () => {
  console.log('Provider metadata example MCP server listening on port 8085');
  console.log('Connect via Streamable HTTP at: http://localhost:8085/mcp');
});
