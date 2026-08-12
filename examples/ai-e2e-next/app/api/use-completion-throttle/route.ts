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
        ...Array(5000).fill({ type: 'text', value: 'T\n' }),
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
