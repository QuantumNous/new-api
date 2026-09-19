import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

const app = express();

const server = new McpServer({
  name: 'mcp-resources-example',
  version: '1.0.0',
});

// Register a fixed resource
server.resource(
  'greeting-resource',
  'file:///example/greeting.txt',
  {
    description: 'A simple greeting text resource',
    mimeType: 'text/plain',
  },
  async () => ({
    contents: [
      {
        uri: 'file:///example/greeting.txt',
        text: 'Hello from a fixed resource!\n',
        mimeType: 'text/plain',
      },
    ],
  }),
);

// Register a resource template: file:///example/{name}.txt
const exampleTemplate = new ResourceTemplate('file:///example/{name}.txt', {
  list: async () => ({
    resources: [
      {
        uri: 'file:///example/dynamic.txt',
        name: 'dynamic.txt',
        description: 'Dynamically listed resource from template',
        mimeType: 'text/plain',
      },
    ],
  }),
});

server.resource(
  'example-template',
  exampleTemplate,
  {
    description: 'Template for example text resources',
    mimeType: 'text/plain',
  },
  async uri => ({
    contents: [
      {
        uri: uri.toString(),
        text: `Content for ${uri.toString()}\n`,
        mimeType: 'text/plain',
      },
    ],
  }),
);

let transport: SSEServerTransport;

app.get('/sse', async (_req, res) => {
  transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(8082, () => {
  console.log(
    'MCP resources example server listening on http://localhost:8082',
  );
});
