import { createUIMessageStreamResponse, simulateReadableStream } from 'ai';

export async function POST(req: Request) {
  return createUIMessageStreamResponse({
    stream: simulateReadableStream({
      initialDelayInMs: 0, // Delay before the first chunk
      chunkDelayInMs: 0, // Delay between chunks
      chunks: [
        {
          type: 'start',
        },
        {
          type: 'start-step',
        },
        {
          type: 'text-start',
          id: 'text-1',
        },
        ...Array(5000).fill({ type: 'text-delta', id: 'text-1', delta: 'T\n' }),
        {
          type: 'text-end',
          id: 'text-1',
        },
        {
          type: 'finish-step',
        },
        {
          type: 'finish',
        },
      ],
    }),
  });
}
