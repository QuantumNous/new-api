/**
 * Test reconnection endpoint.
 * Serves remaining chunks from a previously interrupted stream,
 * starting from the given startIndex query parameter.
 */
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const startIndex = Number(
    new URL(request.url).searchParams.get('startIndex') ?? '0',
  );

  const runs = (globalThis as any).__testRuns ?? {};
  const allChunks = runs[runId];

  if (!allChunks) {
    return Response.json({ error: `Run ${runId} not found` }, { status: 404 });
  }

  // Resolve negative startIndex from the tail
  const tailIndex = allChunks.length - 1;
  const resolvedStart =
    startIndex < 0 ? Math.max(0, allChunks.length + startIndex) : startIndex;
  const remainingChunks = allChunks.slice(resolvedStart);

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of remainingChunks) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-workflow-run-id': runId,
      'x-workflow-stream-tail-index': String(tailIndex),
    },
  });
}
