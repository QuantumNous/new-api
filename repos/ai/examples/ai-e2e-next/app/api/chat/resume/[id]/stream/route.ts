import { loadStreams } from '@/util/chat-store';
import { createUIMessageStream, JsonToSseTransformStream } from 'ai';
import { after } from 'next/server';
import { createResumableStreamContext } from 'resumable-stream';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return new Response('id is required', { status: 400 });
  }

  const streamIds = await loadStreams(id);

  if (!streamIds.length) {
    return new Response(null, { status: 204 });
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new Response(null, { status: 204 });
  }

  const streamContext = createResumableStreamContext({
    waitUntil: after,
  });

  const resumedStream =
    await streamContext.resumeExistingStream(recentStreamId);

  if (!resumedStream) {
    return new Response(null, { status: 204 });
  }

  return new Response(resumedStream);
}
