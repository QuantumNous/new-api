import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import 'dotenv/config';
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.post('/', async function (_, reply) {
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  return reply.send(
    createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    }),
  );
});

fastify.post('/stream-data', async function (_, reply) {
  // immediately start streaming the response
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // send custom data
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

  return reply.send(createUIMessageStreamResponse({ stream }));
});

fastify.listen({ port: 8080 });
