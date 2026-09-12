import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const DASHBOARD_RESOURCE_URI = 'ui://ai-sdk-e2e/dashboard';
const DICE_GAME_RESOURCE_URI = 'ui://ai-sdk-e2e/dice-game';
const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

function createDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI SDK MCP App</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: var(--font-sans, system-ui, sans-serif);
        background: var(--color-background-primary, #ffffff);
        color: var(--color-text-primary, #171717);
      }

      body {
        margin: 0;
        padding: 16px;
      }

      .card {
        border: 1px solid var(--color-border-primary, #d4d4d4);
        border-radius: var(--border-radius-lg, 12px);
        padding: 16px;
        background: var(--color-background-secondary, #fafafa);
      }

      .eyebrow {
        margin: 0 0 8px;
        color: var(--color-text-secondary, #525252);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      h1 {
        margin: 0;
        font-size: 20px;
      }

      p {
        line-height: 1.5;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 16px 0;
      }

      .metric {
        border: 1px solid var(--color-border-primary, #d4d4d4);
        border-radius: var(--border-radius-md, 8px);
        padding: 10px;
        background: var(--color-background-primary, #ffffff);
      }

      .label {
        color: var(--color-text-secondary, #525252);
        font-size: 12px;
      }

      .value {
        margin-top: 4px;
        font-size: 18px;
        font-weight: 600;
      }

      button {
        border: 1px solid var(--color-border-primary, #d4d4d4);
        border-radius: var(--border-radius-md, 8px);
        padding: 8px 12px;
        background: var(--color-background-primary, #ffffff);
        color: inherit;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">MCP App</p>
      <h1>AI SDK dashboard</h1>
      <p>
        This HTML is served from an MCP <code>ui://</code> resource and rendered
        in a sandboxed iframe.
      </p>
      <div class="grid" id="cards">
        <div class="metric">
          <div class="label">Requests</div>
          <div class="value">128</div>
        </div>
        <div class="metric">
          <div class="label">Latency</div>
          <div class="value">42ms</div>
        </div>
        <div class="metric">
          <div class="label">Status</div>
          <div class="value">Healthy</div>
        </div>
      </div>
      <button id="refresh">Call app-only refresh tool</button>
      <p class="label" id="status">Connecting to host...</p>
    </main>

    <script>
      const cards = document.getElementById('cards');
      const status = document.getElementById('status');
      let nextId = 1;
      const pendingRequests = new Map();

      function sendRequest(method, params) {
        const id = nextId++;
        pendingRequests.set(id, method);
        window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
        return id;
      }

      function sendNotification(method, params) {
        window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
      }

      function renderCards(result) {
        const nextCards = result?.structuredContent?.cards;
        if (!Array.isArray(nextCards)) return;

        cards.textContent = '';
        for (const card of nextCards) {
          const metric = document.createElement('div');
          metric.className = 'metric';

          const label = document.createElement('div');
          label.className = 'label';
          label.textContent = String(card.label);

          const value = document.createElement('div');
          value.className = 'value';
          value.textContent = String(card.value);

          metric.append(label, value);
          cards.append(metric);
        }
      }

      window.addEventListener('message', event => {
        const message = event.data;
        if (message?.jsonrpc !== '2.0') return;

        if (message.id != null && pendingRequests.has(message.id)) {
          const method = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);

          if (method === 'ui/initialize') {
            status.textContent = 'Connected to host.';
            sendNotification('ui/notifications/initialized');
          } else if (method === 'tools/call') {
            status.textContent = 'Refreshed from app-only tool.';
            renderCards(message.result);
          }

          return;
        }

        if (message.method === 'ui/notifications/tool-result') {
          renderCards(message.params);
        }
      });

      document.getElementById('refresh').addEventListener('click', () => {
        sendRequest('tools/call', {
          name: 'refreshDashboardData',
          arguments: { reason: 'User clicked refresh in the MCP App' },
        });
      });

      sendRequest('ui/initialize', {
        protocolVersion: '2026-01-26',
        appCapabilities: {
          availableDisplayModes: ['inline', 'fullscreen'],
        },
        appInfo: {
          name: 'ai-sdk-e2e-mcp-app',
          version: '1.0.0',
        },
      });
    </script>
  </body>
</html>`;
}

function createDiceGameHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI SDK MCP Dice Game</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: var(--font-sans, system-ui, sans-serif);
        background: #101827;
        color: #f8fafc;
      }

      body {
        margin: 0;
        padding: 16px;
      }

      main {
        border-radius: 16px;
        padding: 18px;
        background: linear-gradient(135deg, #1e293b, #312e81);
      }

      h1 {
        margin: 0;
        font-size: 22px;
      }

      p {
        color: #cbd5e1;
        line-height: 1.5;
      }

      .die {
        display: grid;
        place-items: center;
        width: 96px;
        height: 96px;
        margin: 18px 0;
        border-radius: 20px;
        background: #f8fafc;
        color: #111827;
        font-size: 44px;
        font-weight: 700;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 10px 16px;
        background: #a7f3d0;
        color: #064e3b;
        cursor: pointer;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Roll for points</h1>
      <p>Roll 12 or higher to score. The button calls an app-only MCP tool.</p>
      <div class="die" id="die">?</div>
      <button id="roll">Roll die</button>
      <p id="status">Connecting...</p>
    </main>

    <script>
      const die = document.getElementById('die');
      const status = document.getElementById('status');
      let nextId = 1;
      let score = 0;
      const pendingRequests = new Map();

      function sendRequest(method, params) {
        const id = nextId++;
        pendingRequests.set(id, method);
        window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
      }

      function sendNotification(method, params) {
        window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
      }

      function updateGame(result) {
        const game = result?.structuredContent;
        if (game == null) return;
        score = Number(game.score) || 0;
        die.textContent = String(game.roll ?? '?');
        status.textContent = game.message || 'Score: ' + score;
      }

      window.addEventListener('message', event => {
        const message = event.data;
        if (message?.jsonrpc !== '2.0') return;

        if (message.id != null && pendingRequests.has(message.id)) {
          const method = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);

          if (method === 'ui/initialize') {
            status.textContent = 'Ready. Score: 0';
            sendNotification('ui/notifications/initialized');
          } else if (method === 'tools/call') {
            updateGame(message.result);
          }

          return;
        }

        if (message.method === 'ui/notifications/tool-result') {
          updateGame(message.params);
        }
      });

      document.getElementById('roll').addEventListener('click', () => {
        sendRequest('tools/call', {
          name: 'showDiceGame',
          arguments: { roll: true, score },
        });
      });

      sendRequest('ui/initialize', {
        protocolVersion: '2026-01-26',
        appCapabilities: {
          availableDisplayModes: ['inline', 'fullscreen'],
        },
        appInfo: {
          name: 'ai-sdk-e2e-dice-game',
          version: '1.0.0',
        },
      });
    </script>
  </body>
</html>`;
}

function createServer() {
  const server = new McpServer(
    {
      name: 'AI SDK MCP Apps E2E Server',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  server.registerResource(
    'dashboard-app',
    DASHBOARD_RESOURCE_URI,
    {
      description: 'Interactive dashboard rendered by an MCP Apps host.',
      mimeType: MCP_APP_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: true,
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_RESOURCE_URI,
          mimeType: MCP_APP_MIME_TYPE,
          text: createDashboardHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
                frameDomains: [],
              },
            },
          },
        },
      ],
    }),
  );

  server.registerResource(
    'dice-game-app',
    DICE_GAME_RESOURCE_URI,
    {
      description: 'Playable dice game rendered by an MCP Apps host.',
      mimeType: MCP_APP_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: DICE_GAME_RESOURCE_URI,
          mimeType: MCP_APP_MIME_TYPE,
          text: createDiceGameHtml(),
        },
      ],
    }),
  );

  server.registerTool(
    'showDashboard',
    {
      title: 'Show Dashboard',
      description: 'Show an interactive MCP App dashboard for a topic.',
      inputSchema: {
        topic: z
          .string()
          .describe(
            'The dashboard topic to display, such as usage or weather.',
          ),
      },
      _meta: {
        ui: {
          resourceUri: DASHBOARD_RESOURCE_URI,
          visibility: ['model', 'app'],
        },
      },
    },
    async ({ topic }) => {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: `Rendered an MCP App dashboard for "${topic}".`,
          },
        ],
        structuredContent: {
          topic,
          cards: [
            { label: 'Requests', value: 128 },
            { label: 'Latency', value: '42ms' },
            { label: 'Status', value: 'Healthy' },
          ],
        },
        _meta: {
          ui: {
            resourceUri: DASHBOARD_RESOURCE_URI,
          },
        },
      };

      console.log('[mcp-apps/server] tool showDashboard', {
        input: { topic },
        result,
      });

      return result;
    },
  );

  server.registerTool(
    'showDiceGame',
    {
      title: 'Show Dice Game',
      description: 'Show or play a MCP App dice game.',
      inputSchema: {
        roll: z.boolean().optional(),
        score: z.number().optional(),
      },
      _meta: {
        ui: {
          resourceUri: DICE_GAME_RESOURCE_URI,
          visibility: ['model', 'app'],
        },
      },
    },
    async ({ roll: shouldRoll = false, score = 0 }) => {
      const roll = shouldRoll ? Math.floor(Math.random() * 20) + 1 : '?';
      const nextScore =
        typeof roll === 'number' && roll >= 12 ? score + 1 : score;

      const result = {
        content: [
          {
            type: 'text' as const,
            text:
              typeof roll === 'number'
                ? `Rolled ${roll}. Score is now ${nextScore}.`
                : 'Rendered a playable dice game.',
          },
        ],
        structuredContent: {
          roll,
          score: nextScore,
          message:
            typeof roll === 'number'
              ? roll >= 12
                ? `Hit! Score: ${nextScore}`
                : `Miss. Score: ${nextScore}`
              : 'Ready. Score: 0',
        },
        _meta: {
          ui: {
            resourceUri: DICE_GAME_RESOURCE_URI,
          },
        },
      };

      console.log('[mcp-apps/server] tool showDiceGame', {
        input: { roll: shouldRoll, score },
        result,
      });

      return result;
    },
  );

  server.registerTool(
    'getWeather',
    {
      title: 'Get Weather',
      description: 'Get the current weather for a city.',
      inputSchema: {
        city: z.string().describe('The city to get weather for.'),
      },
    },
    async ({ city }) => {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: `The weather in ${city} is sunny and 72F.`,
          },
        ],
        structuredContent: {
          city,
          condition: 'sunny',
          temperature: 72,
          unit: 'fahrenheit',
        },
      };

      console.log('[mcp-apps/server] tool getWeather', {
        input: { city },
        result,
      });

      return result;
    },
  );

  server.registerTool(
    'refreshDashboardData',
    {
      title: 'Refresh Dashboard Data',
      description:
        'Refresh the rendered dashboard data. This tool is intended for the MCP App, not the model.',
      inputSchema: {
        reason: z.string().optional(),
      },
      _meta: {
        ui: {
          resourceUri: DASHBOARD_RESOURCE_URI,
          visibility: ['app'],
        },
      },
    },
    async ({ reason }) => {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: `Dashboard data refreshed${reason ? `: ${reason}` : ''}.`,
          },
        ],
        structuredContent: {
          refreshedAt: new Date().toISOString(),
          cards: [
            { label: 'Requests', value: 143 },
            { label: 'Latency', value: '39ms' },
            { label: 'Status', value: 'Healthy' },
          ],
        },
      };

      console.log('[mcp-apps/server] tool refreshDashboardData', {
        input: { reason },
        result,
      });

      return result;
    },
  );

  return server;
}

async function requestHandler(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'DELETE') {
    return Response.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed.',
        },
        id: null,
      },
      { status: 405 },
    );
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export {
  requestHandler as DELETE,
  requestHandler as GET,
  requestHandler as POST,
};
