import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getRuns,
  getRunWithSteps,
  getStepsForRun,
  clearDatabase,
  reloadDb,
  validateRemoteDbPath,
} from '../db.js';

// SSE client management
type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController<string>;
};

const sseClients = new Set<SSEClient>();

const broadcastToClients = (event: string, data: Record<string, unknown>) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.controller.enqueue(message);
    } catch {
      // Client disconnected, will be cleaned up
      sseClients.delete(client);
    }
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine whether to use the dev-mode Vite proxy or serve the built client.
//
// We rely exclusively on an explicit env flag to avoid false positives in
// monorepos where /dist paths are common.
//
//   AI_SDK_DEVTOOLS_DEV=true  → use dev mode (Vite proxy)
//   AI_SDK_DEVTOOLS_DEV=false → use production mode (serve built client)
//
// If the flag is unset, default to production mode.
const devEnv = process.env.AI_SDK_DEVTOOLS_DEV;
const isDevMode = devEnv !== undefined && devEnv !== 'false' && devEnv !== '0';
// __dirname points at packages/devtools/src/viewer, so ../.. is the package root.
const projectRoot = path.resolve(__dirname, '../..');

// Client directory: dist/client in both cases
const clientDir = path.join(projectRoot, 'dist/client');

// Track the DB path from the most recent notify call so all reads
// use the correct file, even when the viewer runs in a different CWD.
let remoteDbPath: string | undefined;
let viewerPort = 4983;

export const app = new Hono();

const getAllowedHosts = () =>
  new Set([
    `localhost:${viewerPort}`,
    `127.0.0.1:${viewerPort}`,
    `[::1]:${viewerPort}`,
  ]);

const getAllowedOrigins = () =>
  new Set([
    `http://localhost:${viewerPort}`,
    `http://127.0.0.1:${viewerPort}`,
    `http://[::1]:${viewerPort}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
  ]);

app.use('/api/*', async (c, next) => {
  const host = c.req.header('host');
  if (!host || !getAllowedHosts().has(host)) {
    return c.text('Forbidden', 403);
  }

  const origin = c.req.header('origin');
  if (origin && !getAllowedOrigins().has(origin)) {
    return c.text('Forbidden', 403);
  }

  await next();
});

// API Routes
app.get('/api/runs', async c => {
  await reloadDb(remoteDbPath);
  const runs = await getRuns();
  // Only return root-level runs (no parent) in the sidebar list
  const rootRuns = runs.filter(r => !r.parent_run_id);
  const runsWithMeta = await Promise.all(
    rootRuns.map(async run => {
      const steps = await getStepsForRun(run.id);
      let firstMessage = 'No user message';
      let hasError = false;
      let isInProgress = false;

      // Extract last user message from first step
      const firstStep = steps[0];
      if (firstStep) {
        try {
          const input = JSON.parse(firstStep.input);
          const userMsg = input?.prompt?.findLast(
            (m: any) => m.role === 'user',
          );
          if (userMsg) {
            const content =
              typeof userMsg.content === 'string'
                ? userMsg.content
                : userMsg.content?.[0]?.text || '';
            firstMessage =
              content.slice(0, 60) + (content.length > 60 ? '...' : '');
          }
        } catch {
          // Ignore JSON parse errors
        }

        // Check for errors
        hasError = steps.some(s => s.error);
        // Check if any step is still in progress (no output yet)
        isInProgress = steps.some(s => s.duration_ms === null && !s.error);
      }

      return {
        ...run,
        stepCount: steps.length,
        firstMessage,
        hasError,
        isInProgress,
        type: firstStep?.type,
      };
    }),
  );
  return c.json(runsWithMeta);
});

app.get('/api/runs/:id', async c => {
  await reloadDb(remoteDbPath);
  const data = await getRunWithSteps(c.req.param('id'));
  if (!data) {
    return c.json({ error: 'Run not found' }, 404);
  }
  // Compute isInProgress from steps (any step without duration_ms or error)
  const isInProgress = data.steps.some(s => s.duration_ms === null && !s.error);

  // Recursively collect all descendant runs so the viewer can render
  const allRuns = await getRuns();

  interface DescendantRun {
    run: (typeof allRuns)[number] & { isInProgress: boolean };
    steps: Awaited<ReturnType<typeof getStepsForRun>>;
    childRuns: DescendantRun[];
  }

  async function getDescendantRuns(
    parentRunId: string,
  ): Promise<DescendantRun[]> {
    const children = allRuns.filter(r => r.parent_run_id === parentRunId);
    return Promise.all(
      children.map(async childRun => {
        const childSteps = await getStepsForRun(childRun.id);
        const childIsInProgress = childSteps.some(
          s => s.duration_ms === null && !s.error,
        );
        const grandchildren = await getDescendantRuns(childRun.id);
        return {
          run: { ...childRun, isInProgress: childIsInProgress },
          steps: childSteps,
          childRuns: grandchildren,
        };
      }),
    );
  }

  const childRuns = await getDescendantRuns(data.run.id);

  return c.json({
    run: { ...data.run, isInProgress },
    steps: data.steps,
    childRuns,
  });
});

app.post('/api/clear', async c => {
  await clearDatabase();
  return c.json({ success: true });
});

// SSE endpoint for real-time updates
app.get('/api/events', c => {
  return streamSSE(c, async stream => {
    const clientId = crypto.randomUUID();

    // Create a client wrapper that uses the stream
    const client: SSEClient = {
      id: clientId,
      controller: null as unknown as ReadableStreamDefaultController<string>,
    };

    // Send initial connection message
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ clientId }),
    });

    // Register client for broadcasts
    const originalWrite = stream.writeSSE.bind(stream);
    client.controller = {
      enqueue: (message: string) => {
        // Parse the raw SSE message and use writeSSE
        const lines = message.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7);
          } else if (line.startsWith('data: ')) {
            data = line.slice(6);
          }
        }
        originalWrite({ event, data }).catch(() => {});
      },
    } as ReadableStreamDefaultController<string>;

    sseClients.add(client);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ time: Date.now() }),
        });
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Wait for client disconnect
    try {
      while (true) {
        await stream.sleep(1000);
      }
    } finally {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  });
});

// Notification endpoint (called by middleware/integration)
app.post('/api/notify', async c => {
  const body = (await c.req.json()) as Record<string, unknown>;
  if (body.dbPath !== undefined) {
    const validatedDbPath = validateRemoteDbPath(body.dbPath);
    if (!validatedDbPath) {
      return c.text('Invalid dbPath', 400);
    }
    remoteDbPath = validatedDbPath;
  }
  // Reload database from disk, using the remote dbPath if provided so the
  // viewer works even when started from a different directory than the app.
  await reloadDb(remoteDbPath);
  broadcastToClients('update', body);
  return c.json({ success: true });
});

// Serve static files (pre-built React app)
app.use(
  '/assets/*',
  serveStatic({
    root: clientDir.replace(/\/+$/, ''),
  }),
);

// Fallback to index.html for SPA routing
app.get('*', async c => {
  // In dev mode, redirect to Vite dev server
  if (isDevMode) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>AI SDK DevTools</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
            .container { text-align: center; }
            a { color: #3b82f6; text-decoration: none; font-size: 1.25rem; }
            a:hover { text-decoration: underline; }
            p { color: #737373; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Development Mode</h2>
            <a href="http://localhost:5173">Open DevTools UI →</a>
            <p>This port (4983) only serves the API in dev mode.</p>
          </div>
        </body>
      </html>
    `);
  }

  const indexPath = path.join(clientDir, 'index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf-8');
    return c.html(html);
  } catch {
    return c.text('DevTools client not built. Run `pnpm build` first.', 500);
  }
});

export const startViewer = (port = 4983) => {
  viewerPort = port;

  const server = serve(
    {
      fetch: app.fetch,
      port,
      hostname: 'localhost',
    },
    () => {
      if (isDevMode) {
        console.log(`🔍 AI SDK DevTools API running on port ${port}`);
        console.log(`   Open http://localhost:5173 for the dev UI`);
      } else {
        console.log(`🔍 AI SDK DevTools running at http://localhost:${port}`);
      }
    },
  );

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${port} is already in use.`);
      console.error(
        `\n   This likely means AI SDK DevTools is already running.`,
      );
      console.error(`   Open http://localhost:${port} in your browser.\n`);
      console.error(`   To use a different port, set AI_SDK_DEVTOOLS_PORT:\n`);
      console.error(
        `   AI_SDK_DEVTOOLS_PORT=4984 npx @ai-sdk/devtools@latest\n`,
      );
      process.exit(1);
    }
    throw err;
  });
};

// Allow running directly
const currentFile = fileURLToPath(import.meta.url);
const isDirectRun =
  process.argv[1] === currentFile ||
  process.argv[1]?.endsWith('/server.ts') ||
  process.argv[1]?.endsWith('/server.js');

if (isDirectRun) {
  const port = process.env.AI_SDK_DEVTOOLS_PORT
    ? parseInt(process.env.AI_SDK_DEVTOOLS_PORT)
    : 4983;
  startViewer(port);
}
