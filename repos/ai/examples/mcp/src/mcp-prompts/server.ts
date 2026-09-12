import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { z } from 'zod';

const app = express();

const server = new McpServer({
  name: 'mcp-prompts-example',
  version: '1.0.0',
});

server.prompt(
  'code_review',
  'Asks the LLM to analyze code quality and suggest improvements',
  { code: z.string() },
  async ({ code }) => {
    return {
      description: 'Code review prompt',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this code and suggest improvements:\n${code}`,
          },
        },
      ],
    };
  },
);

let transport: SSEServerTransport;

app.get('/sse', async (_req, res) => {
  transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(8083, () => {
  console.log('MCP prompts example server listening on http://localhost:8083');
});
