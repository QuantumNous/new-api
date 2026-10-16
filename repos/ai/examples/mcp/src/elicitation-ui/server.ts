import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

const app = express();

const server = new McpServer(
  {
    name: 'elicitation-ui-server',
    version: '1.0.0',
  },
  {
    capabilities: {},
  },
);

server.registerTool(
  'register_user',
  {
    description: 'Register a new user account by collecting their information',
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
      const result = await elicitInput({
        message: 'Please provide your registration information:',
        requestedSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              title: 'Username',
              description: 'Your desired username (3-20 characters)',
              minLength: 3,
              maxLength: 20,
            },
            email: {
              type: 'string',
              title: 'Email',
              description: 'Your email address',
              format: 'email',
            },
            password: {
              type: 'string',
              title: 'Password',
              description: 'Your password (min 8 characters)',
              minLength: 8,
            },
            newsletter: {
              type: 'boolean',
              title: 'Newsletter',
              description: 'Subscribe to newsletter?',
              default: false,
            },
          },
          required: ['username', 'email', 'password'],
        },
      });

      if (result.action === 'accept' && result.content) {
        const { username, email, newsletter } = result.content as {
          username: string;
          email: string;
          password: string;
          newsletter?: boolean;
        };

        console.log('[register_user] Accepted registration payload:', {
          username,
          email,
          newsletter: newsletter ?? false,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Registration successful!\n\nUsername: ${username}\nEmail: ${email}\nNewsletter: ${
                newsletter ? 'Yes' : 'No'
              }`,
            },
          ],
        };
      }

      if (result.action === 'decline') {
        console.log('[register_user] User declined to register.');
        return {
          content: [
            {
              type: 'text',
              text: 'Registration cancelled by user.',
            },
          ],
        };
      }

      console.log('[register_user] Registration cancelled by user.');
      return {
        content: [
          {
            type: 'text',
            text: 'Registration was cancelled.',
          },
        ],
      };
    } catch (error) {
      console.error('[register_user] Registration failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Registration failed: ${
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

app.listen(8085, () => {
  console.log('MCP elicitation UI server listening on http://localhost:8085');
});
