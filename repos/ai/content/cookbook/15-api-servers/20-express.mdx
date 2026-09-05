---
title: Express
description: Learn how to use the AI SDK in an Express server
tags: ['api servers', 'streaming']
---

# Express

You can use the AI SDK in an [Express](https://expressjs.com/) server to generate and stream text and objects to the client.

## Examples

The examples start a simple HTTP server that listens on port 8080. You can e.g. test it using `curl`:

```bash
curl -X POST http://localhost:8080
```

<Note>
  The examples use the Vercel AI Gateway. Ensure that your AI Gateway API key is
  set in the `AI_GATEWAY_API_KEY` environment variable.
</Note>

**Full example**: [github.com/vercel/ai/examples/express](https://github.com/vercel/ai/tree/main/examples/express)

### UI Message Stream

You can use the `pipeUIMessageStreamToResponse` helper to pipe the stream data to the server response.

```ts filename='index.ts'
import {
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import express, { Request, Response } from 'express';

const app = express();

app.post('/', async (req: Request, res: Response) => {
  const result = streamText({
    model: 'openai/gpt-4o',
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  pipeUIMessageStreamToResponse({
    response: res,
    stream: toUIMessageStream({ stream: result.stream }),
  });
});

app.listen(8080, () => {
  console.log(`Example app listening on port ${8080}`);
});
```

### Sending Custom Data

`pipeUIMessageStreamToResponse` can be used to send custom data to the client.

```ts filename='index.ts'
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import express, { Request, Response } from 'express';

const app = express();

app.post('/custom-data-parts', async (req: Request, res: Response) => {
  pipeUIMessageStreamToResponse({
    response: res,
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' });

        writer.write({
          type: 'data-custom',
          data: {
            custom: 'Hello, world!',
          },
        });

        const result = streamText({
          model: 'openai/gpt-4o',
          prompt: 'Invent a new holiday and describe its traditions.',
        });

        writer.merge(
          toUIMessageStream({ stream: result.stream, sendStart: false }),
        );
      },
    }),
  });
});

app.listen(8080, () => {
  console.log(`Example app listening on port ${8080}`);
});
```

### Text Stream

You can send a text stream to the client using `pipeTextStreamToResponse`.

```ts filename='index.ts'
import { pipeTextStreamToResponse, streamText, toTextStream } from 'ai';
import express, { Request, Response } from 'express';

const app = express();

app.post('/', async (req: Request, res: Response) => {
  const result = streamText({
    model: 'openai/gpt-4o',
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  pipeTextStreamToResponse({
    response: res,
    stream: toTextStream({ stream: result.stream }),
  });
});

app.listen(8080, () => {
  console.log(`Example app listening on port ${8080}`);
});
```

## Troubleshooting

- Streaming not working when [proxied](/docs/troubleshooting/streaming-not-working-when-proxied)
