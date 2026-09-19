import {
  JsonToSseTransformStream,
  readUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { describe, expect, it } from 'vitest';
import { WorkflowChatTransport } from './workflow-chat-transport.js';

/**
 * Builds a mock `fetch` whose response body is the given UIMessageChunks
 * encoded as the JSON/SSE event stream the transport expects, with the
 * `x-workflow-run-id` header the transport requires.
 */
function fetchReturning(chunks: UIMessageChunk[]): typeof fetch {
  return (async () => {
    const body = new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    })
      .pipeThrough(new JsonToSseTransformStream())
      .pipeThrough(new TextEncoderStream());

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-workflow-run-id': 'wrun_test',
      },
    });
  }) as unknown as typeof fetch;
}

/**
 * Drives a transport-produced stream through the real AI SDK consumer
 * (the same state machine that backs `useChat`). Returns the final assembled
 * text, reasoning, and any framing error the consumer reported.
 */
async function consume(stream: ReadableStream<UIMessageChunk>) {
  let consumerError: Error | undefined;
  let lastMessage: UIMessage | undefined;
  for await (const message of readUIMessageStream({
    stream,
    onError: error => {
      consumerError = error as Error;
    },
  })) {
    lastMessage = message;
  }
  const parts = lastMessage?.parts ?? [];
  const text = parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
  const reasoning = parts
    .filter(
      (p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning',
    )
    .map(p => p.text)
    .join('');
  return { consumerError, text, reasoning };
}

async function sendAndConsume(chunks: UIMessageChunk[]) {
  const transport = new WorkflowChatTransport({
    fetch: fetchReturning(chunks),
  });
  const stream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'chat_test',
    messages: [],
  });
  return consume(stream);
}

// A duplicated/interleaved execution of the stream-producing step lands a
// `finish-step` in the middle of a text part that reuses id "0", orphaning the
// rest of the part. This is the exact shape behind
// "Received text-delta for missing text part with ID 0" (vercel/workflow#2422).
const INTERLEAVED: UIMessageChunk[] = [
  { type: 'start', messageId: 'm1' },
  { type: 'start-step' },
  { type: 'text-start', id: '0' },
  { type: 'text-delta', id: '0', delta: 'Hello' },
  // finish-step from a second/duplicated execution resets the consumer's
  // active text parts, closing id "0" prematurely.
  { type: 'finish-step' },
  { type: 'text-delta', id: '0', delta: ' world' },
  { type: 'text-end', id: '0' },
  { type: 'finish' },
];

describe('WorkflowChatTransport UI message stream repair (issue #2422)', () => {
  it('demonstrates the raw interleaved stream is fatal to the AI SDK consumer', async () => {
    // Sanity check on the unrepaired stream: prove the chunk shape really does
    // trigger the reported error, so the repair test below is meaningful.
    const raw = new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const chunk of INTERLEAVED) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    const { consumerError } = await consume(raw);
    expect(consumerError?.message).toContain(
      'Received text-delta for missing text part with ID "0"',
    );
  });

  it('repairs an interleaved stream so the consumer does not fail the turn', async () => {
    const { consumerError, text } = await sendAndConsume(INTERLEAVED);
    expect(consumerError).toBeUndefined();
    // No content is lost — the orphaned delta is re-framed rather than dropped.
    expect(text).toBe('Hello world');
  });

  it('drops a re-delivered (reconnect/replay) duplicate tail without erroring', async () => {
    const DUPLICATED: UIMessageChunk[] = [
      { type: 'start', messageId: 'm1' },
      { type: 'start-step' },
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'Hello world' },
      { type: 'text-end', id: '0' },
      // Replayed copy of the same already-ended part (no finish-step between).
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'Hello world' },
      { type: 'text-end', id: '0' },
      { type: 'finish' },
    ];
    const { consumerError, text } = await sendAndConsume(DUPLICATED);
    expect(consumerError).toBeUndefined();
    expect(text).toBe('Hello world');
  });

  it('passes a well-formed multi-step stream through unchanged', async () => {
    const WELL_FORMED: UIMessageChunk[] = [
      { type: 'start', messageId: 'm1' },
      { type: 'start-step' },
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'one' },
      { type: 'text-end', id: '0' },
      { type: 'finish-step' },
      // Second step legitimately reuses id "0" after the consumer reset.
      { type: 'start-step' },
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'two' },
      { type: 'text-end', id: '0' },
      { type: 'finish-step' },
      { type: 'finish' },
    ];
    const { consumerError, text } = await sendAndConsume(WELL_FORMED);
    expect(consumerError).toBeUndefined();
    expect(text).toBe('onetwo');
  });

  // Reasoning parts have the same fragility as text (the consumer resets
  // activeReasoningParts on finish-step and ids are reused), so the repair must
  // cover them too. Drives the real consumer rather than asserting structurally.
  const INTERLEAVED_REASONING: UIMessageChunk[] = [
    { type: 'start', messageId: 'm1' },
    { type: 'start-step' },
    { type: 'reasoning-start', id: '0' },
    { type: 'reasoning-delta', id: '0', delta: 'Think' },
    // finish-step from a duplicated execution resets activeReasoningParts,
    // orphaning the rest of id "0".
    { type: 'finish-step' },
    { type: 'reasoning-delta', id: '0', delta: 'ing...' },
    { type: 'reasoning-end', id: '0' },
    { type: 'finish' },
  ];

  it('demonstrates the raw interleaved reasoning stream is fatal to the consumer', async () => {
    const raw = new ReadableStream<UIMessageChunk>({
      start(controller) {
        for (const chunk of INTERLEAVED_REASONING) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    const { consumerError } = await consume(raw);
    expect(consumerError?.message).toContain(
      'Received reasoning-delta for missing reasoning part with ID "0"',
    );
  });

  it('repairs an interleaved reasoning stream with no content lost', async () => {
    const { consumerError, reasoning } = await sendAndConsume(
      INTERLEAVED_REASONING,
    );
    expect(consumerError).toBeUndefined();
    expect(reasoning).toBe('Thinking...');
  });
});
