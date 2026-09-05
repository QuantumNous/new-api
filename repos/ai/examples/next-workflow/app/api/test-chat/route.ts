/**
 * Test endpoint that simulates an interrupted stream.
 * Sends a few SSE chunks but deliberately omits the "finish" event,
 * forcing WorkflowChatTransport to reconnect via the GET stream endpoint.
 */
export async function POST(req: Request) {
  const { messages } = await req.json();
  const runId = `test-run-${Date.now()}`;
  const lastMessage = messages?.[messages.length - 1];
  const userText =
    lastMessage?.parts?.find((p: { type: string }) => p.type === 'text')
      ?.text ??
    lastMessage?.content ??
    '';

  // Store the run data in a global map so the reconnection endpoint can find it
  const allChunks = buildResponseChunks(userText);
  (globalThis as any).__testRuns = (globalThis as any).__testRuns ?? {};
  (globalThis as any).__testRuns[runId] = allChunks;

  // Only send a partial stream (first 2 chunks) to simulate interruption
  const partialChunks = allChunks.slice(0, 2);

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of partialChunks) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      // Close WITHOUT sending "finish" — simulates a timeout/disconnect
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-workflow-run-id': runId,
    },
  });
}

function buildResponseChunks(userText: string) {
  const textId = `text-${Date.now()}`;

  return [
    // Chunk 0: start of assistant message
    {
      type: 'start',
      messageId: `msg-${Date.now()}`,
    },
    // Chunk 1: text-start (this is all the POST stream sends before "interruption")
    {
      type: 'text-start',
      id: textId,
    },
    // Chunk 2: first text delta (reconnection picks up from here)
    {
      type: 'text-delta',
      id: textId,
      delta: `You asked: "${userText}". `,
    },
    // Chunk 3: second text delta
    {
      type: 'text-delta',
      id: textId,
      delta:
        'This response was interrupted and recovered via WorkflowChatTransport reconnection!',
    },
    // Chunk 4: text-end
    {
      type: 'text-end',
      id: textId,
    },
    // Chunk 5: finish
    {
      type: 'finish',
    },
  ];
}
