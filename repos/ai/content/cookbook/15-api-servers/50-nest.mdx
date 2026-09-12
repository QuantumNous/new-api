---
title: Nest.js
description: Learn how to use the AI SDK in a Nest.js server
tags: ['api servers', 'streaming']
---

# Nest.js

You can use the AI SDK in a [Nest.js](https://nestjs.com/) server to generate and stream text and objects to the client.

## Examples

The examples show how to implement a Nest.js controller that uses the AI SDK to stream text and objects to the client.

**Full example**: [github.com/vercel/ai/examples/nest](https://github.com/vercel/ai/tree/main/examples/nest)

### UI Message Stream

You can use the `pipeUIMessageStreamToResponse` helper to pipe the stream data to the server response.

```ts filename='app.controller.ts'
import { Controller, Post, Res } from '@nestjs/common';
import {
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import { Response } from 'express';

@Controller()
export class AppController {
  @Post('/')
  async root(@Res() res: Response) {
    const result = streamText({
      model: 'openai/gpt-4o',
      prompt: 'Invent a new holiday and describe its traditions.',
    });

    pipeUIMessageStreamToResponse({
      response: res,
      stream: toUIMessageStream({ stream: result.stream }),
    });
  }
}
```

### Sending Custom Data

`createUIMessageStream` and `pipeUIMessageStreamToResponse` can be used to send custom data to the client.

```ts filename='app.controller.ts'
import { Controller, Post, Res } from '@nestjs/common';
import {
  createUIMessageStream,
  streamText,
  pipeUIMessageStreamToResponse,
  toUIMessageStream,
} from 'ai';
import { Response } from 'express';

@Controller()
export class AppController {
  @Post('/stream-data')
  async streamData(@Res() response: Response) {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        // write some data
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
    pipeUIMessageStreamToResponse({ stream, response });
  }
}
```

### Text Stream

You can use the `pipeTextStreamToResponse` helper with `toTextStream` to pipe a text stream to the response.

```ts filename='app.controller.ts'
import { Controller, Post, Res } from '@nestjs/common';
import { pipeTextStreamToResponse, streamText, toTextStream } from 'ai';
import { Response } from 'express';

@Controller()
export class AppController {
  @Post()
  async example(@Res() res: Response) {
    const result = streamText({
      model: 'openai/gpt-4o',
      prompt: 'Invent a new holiday and describe its traditions.',
    });

    pipeTextStreamToResponse({
      response: res,
      stream: toTextStream({ stream: result.stream }),
    });
  }
}
```

## Troubleshooting

- Streaming not working when [proxied](/docs/troubleshooting/streaming-not-working-when-proxied)
