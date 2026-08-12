import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

const mcpServer = new McpServer({
  name: 'tool-caching-example-server',
  version: '1.0.0',
});

mcpServer.tool(
  'add',
  'Add two numbers together',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  },
  async ({ a, b }) => {
    return {
      content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
    };
  },
);

mcpServer.tool('get-current-time', 'Get the current time', async () => {
  return {
    content: [
      { type: 'text', text: `Current time: ${new Date().toISOString()}` },
    ],
  };
});

mcpServer.tool(
  'greet',
  'Greet a person by name',
  {
    name: z.string().describe('Name of the person to greet'),
  },
  async ({ name }) => {
    return {
      content: [{ type: 'text', text: `Hello, ${name}! Nice to meet you.` }],
    };
  },
);

let transport: SSEServerTransport;

const app = express();

app.get('/sse', async (req, res) => {
  transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);
});

app.post('/messages', async (req, res) => {
  await transport.handlePostMessage(req, res);
});

const PORT = 8085;
app.listen(PORT, () => {
  console.log(`Tool caching example MCP server listening on port ${PORT}`);
});
