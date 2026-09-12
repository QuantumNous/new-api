import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

const mcpServer = new McpServer({
  name: 'output-schema-example-server',
  version: '1.0.0',
});

mcpServer.tool(
  'get-weather',
  'Get weather data for a location',
  {
    location: z.string().describe('City name or zip code'),
  },
  async ({ location }) => {
    const weatherData = {
      temperature: 22.5,
      conditions: 'Sunny',
      humidity: 65,
      location,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(weatherData),
        },
      ],
      structuredContent: weatherData,
    };
  },
);

// Tool with complex nested response
mcpServer.tool(
  'list-users',
  'List all users with their details',
  {}, // No input parameters
  async () => {
    const usersData = {
      users: [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
        { id: 3, name: 'Charlie', email: 'charlie@example.com' },
      ],
      metadata: {
        total: 3,
        page: 1,
        hasMore: false,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(usersData),
        },
      ],
      structuredContent: usersData,
    };
  },
);

// Tool without structuredContent
mcpServer.tool(
  'echo',
  'Echo back the input message',
  {
    message: z.string(),
  },
  async ({ message }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Echo: ${message}`,
        },
      ],
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

const PORT = 8081;
app.listen(PORT, () => {
  console.log(`Output Schema Example MCP server listening on port ${PORT}`);
  console.log(`Connect via SSE at: http://localhost:${PORT}/sse`);
});
