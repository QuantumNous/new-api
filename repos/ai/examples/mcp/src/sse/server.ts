import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

const mcpServer = new McpServer({
  name: 'example-server',
  version: '1.0.0',
});

// Tool with arguments:
mcpServer.tool(
  'check-product-stock',
  'Check if a product is available',
  {
    productName: z.string(),
  },
  async ({ productName }) => {
    return {
      content: [
        {
          type: 'text',
          text: `The product ${productName} is available in stock`,
        },
      ],
    };
  },
);

// Tool with zero arguments:
mcpServer.tool('list-products', 'List all products', async () => {
  return {
    content: [
      { type: 'text', text: 'Products: Product 1, Product 2, Product 3' },
    ],
  };
});

let transport: SSEServerTransport;

const app = express();

app.get('/sse', async (req, res) => {
  transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);
});

app.post('/messages', async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(8080, () => {
  console.log(`Example SSE MCP server listening on port ${8080}`);
});
