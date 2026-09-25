import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const server = new McpServer(
    {
      name: 'server-with-instructions',
      version: '1.0.0',
    },
    {
      instructions:
        'Use search tools to resolve IDs — never ask the user. Always confirm destructive actions before executing.',
    },
  );

  server.tool('ping', 'A simple ping tool', async () => {
    return { content: [{ type: 'text', text: 'pong' }] };
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on('close', () => {
    transport.close();
    server.close();
  });
});

app.listen(3000, () => {
  console.log('server-instructions example server listening on port 3000');
});
