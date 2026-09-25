import { createModelCallToUIChunkTransform } from '@ai-sdk/workflow';
import type { NextRequest } from 'next/server';
import { getRun } from 'workflow/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const startIndex = Number(
      new URL(request.url).searchParams.get('startIndex') ?? '0',
    );

    const run = await getRun(runId);
    const readable = run
      .getReadable({ startIndex })
      .pipeThrough(createModelCallToUIChunkTransform());

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Workflow-Run-Id': runId,
      },
    });
  } catch (error) {
    console.error('Error reconnecting to chat stream:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
