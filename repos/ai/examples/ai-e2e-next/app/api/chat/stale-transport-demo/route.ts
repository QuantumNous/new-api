import { createUIMessageStreamResponse, simulateReadableStream } from 'ai';

// Echoes the `subagent` value received so the stale-transport fix (#7819) can be verified
export async function POST(req: Request) {
  const body = await req.json();
  const subagent = JSON.stringify(body?.subagent ?? null);

  return createUIMessageStreamResponse({
    stream: simulateReadableStream({
      initialDelayInMs: 0,
      chunkDelayInMs: 0,
      chunks: [
        { type: 'start' },
        { type: 'start-step' },
        { type: 'text-start', id: '0' },
        {
          type: 'text-delta',
          id: '0',
          delta: `Server received subagent = ${subagent}`,
        },
        { type: 'text-end', id: '0' },
        { type: 'finish-step' },
        { type: 'finish' },
      ],
    }),
  });
}
