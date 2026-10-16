import { openai } from '@ai-sdk/openai';
import { serve } from '@hono/node-server';
import {
  createAgentUIStreamResponse,
  createTextStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toTextStream,
  toUIMessageStream,
} from 'ai';
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { openaiWebSearchAgent } from './openai-web-search-agent';

const app = new Hono();

// CORS setup to allow calls from localhost:3000
app.use(
  '/chat/*',
  cors({
    origin: 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

app.post('/', async c => {
  console.log('POST /');
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
});

app.post('/text', async c => {
  console.log('POST /text');
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Write a short poem about coding.',
  });
  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
});

app.post('/stream-data', async c => {
  console.log('POST /stream-data');

  // immediately start streaming the response
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });

      writer.write({
        type: 'data-custom',
        data: {
          custom: 'Hello, world!',
        },
      });

      const result = streamText({
        model: openai('gpt-4o'),
        prompt: 'Invent a new holiday and describe its traditions.',
      });

      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          onError: error => {
            // Error messages are masked by default for security reasons.
            // If you want to expose the error message to the client, you can do so here:
            return error instanceof Error ? error.message : String(error);
          },
        }),
      );
    },
  });
  return createUIMessageStreamResponse({ stream });
});

// useChat example using Agent
app.post('/chat', async c => {
  console.log('POST /chat');

  const { messages } = await c.req.json();

  return createAgentUIStreamResponse({
    agent: openaiWebSearchAgent,
    uiMessages: messages,
  });
});

app.get('/health', c => c.text('Hono AI SDK example server is running!'));

console.log('Server starting on http://localhost:8080');
serve({ fetch: app.fetch, port: 8080 });
