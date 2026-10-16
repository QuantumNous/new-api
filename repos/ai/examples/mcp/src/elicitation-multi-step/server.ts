import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { z } from 'zod';

const app = express();

const server = new McpServer(
  {
    name: 'elicitation-multi-step-server',
    version: '1.0.0',
  },
  {
    capabilities: {},
  },
);

server.registerTool(
  'create_event',
  {
    description: 'Create a calendar event by collecting event details',
    inputSchema: {},
  },
  async () => {
    const elicitInput = server.server?.elicitInput?.bind(server.server);

    if (!elicitInput) {
      return {
        content: [
          {
            type: 'text',
            text: 'Elicitation is not supported by this SDK version.',
          },
        ],
      };
    }

    try {
      const basicInfo = await elicitInput({
        message: 'Step 1: Enter basic event information',
        requestedSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              title: 'Event Title',
              description: 'Name of the event',
              minLength: 1,
            },
            description: {
              type: 'string',
              title: 'Description',
              description: 'Event description (optional)',
            },
          },
          required: ['title'],
        },
      });

      if (basicInfo.action !== 'accept' || !basicInfo.content) {
        console.log('[create_event] Event creation cancelled at step 1.');
        return {
          content: [{ type: 'text', text: 'Event creation cancelled.' }],
        };
      }

      const dateTime = await elicitInput({
        message: 'Step 2: Enter date and time',
        requestedSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              title: 'Date',
              description: 'Event date',
            },
            startTime: {
              type: 'string',
              title: 'Start Time',
              description: 'Event start time (HH:MM)',
            },
            duration: {
              type: 'integer',
              title: 'Duration',
              description: 'Duration in minutes',
              minimum: 15,
              maximum: 480,
            },
          },
          required: ['date', 'startTime', 'duration'],
        },
      });

      if (dateTime.action !== 'accept' || !dateTime.content) {
        console.log('[create_event] Event creation cancelled at step 2.');
        return {
          content: [{ type: 'text', text: 'Event creation cancelled.' }],
        };
      }

      const event = {
        ...basicInfo.content,
        ...dateTime.content,
      };

      console.log('[create_event] Event created:', event);

      return {
        content: [
          {
            type: 'text',
            text: `Event created successfully!\n\n${JSON.stringify(
              event,
              null,
              2,
            )}`,
          },
        ],
      };
    } catch (error) {
      console.error('[create_event] Event creation failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Event creation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
);

let transport: SSEServerTransport | undefined;

app.get('/sse', async (_req, res) => {
  transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  if (!transport) {
    res.status(503).json({ error: 'Server not ready' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

app.listen(8084, () => {
  console.log(
    'MCP multi-step elicitation server listening on http://localhost:8084',
  );
});
