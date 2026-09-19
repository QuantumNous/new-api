import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const server = new McpServer({
    name: 'my-dumb-server',
    version: '2.000.0',
  });

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
  console.log('server-info example server listening on port 3000');
});
