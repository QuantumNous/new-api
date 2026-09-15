import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

const WEATHER_WIDGET_URI = 'ui://widgets/weather.html';

const mcpServer = new McpServer(
  {
    name: 'tool-meta-example-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
    },
  },
);

mcpServer.registerTool(
  'get-weather',
  {
    description: 'Get weather information for a location',
    inputSchema: {
      location: z.string().describe('City name'),
    },
    _meta: {
      'openai/outputTemplate': WEATHER_WIDGET_URI,
    },
  },
  async ({ location }) => {
    return {
      content: [
        {
          type: 'text',
          text: `Weather in ${location}: Sunny, 22°C`,
        },
      ],
    };
  },
);

mcpServer.registerResource(
  'weather-widget',
  WEATHER_WIDGET_URI,
  {},
  async () => {
    return {
      contents: [
        {
          uri: 'ui://widgets/weather.html',
          mimeType: 'text/html+skybridge',
          text: `<div>Weather widget</div>`,
        },
      ],
      _meta: {},
    };
  },
);

mcpServer.registerTool(
  'get-time',
  {
    description: 'Get current time',
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: `Current time: ${new Date().toISOString()}`,
        },
      ],
    };
  },
);

app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      mcpServer.close();
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

app.listen(8084, () => {
  console.log('Tool meta example server listening on http://localhost:8084');
});
