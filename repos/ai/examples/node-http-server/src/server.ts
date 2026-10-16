import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import 'dotenv/config';
import { createServer } from 'http';

createServer(async (req, res) => {
  switch (req.url) {
    case '/': {
      const result = streamText({
        model: openai('gpt-4o'),
        prompt: 'Invent a new holiday and describe its traditions.',
      });

      pipeUIMessageStreamToResponse({
        response: res,
        stream: toUIMessageStream({ stream: result.stream }),
      });
      break;
    }

    case '/stream-data': {
      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          // write some custom data
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

      pipeUIMessageStreamToResponse({ stream, response: res });

      break;
    }
  }
}).listen(8080);
