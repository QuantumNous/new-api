import { createUIMessageStreamResponse } from 'ai';
import type { NextRequest } from 'next/server';
import { getRun } from 'workflow/api';
import { toUIMessageStream } from '@/workflow/sandbox-agent';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const startIndex = Number(
    new URL(request.url).searchParams.get('startIndex') ?? '0',
  );
  const run = await getRun(runId);

  return createUIMessageStreamResponse({
    stream: toUIMessageStream(run.getReadable({ startIndex })),
    headers: {
      'x-workflow-run-id': runId,
    },
  });
}
