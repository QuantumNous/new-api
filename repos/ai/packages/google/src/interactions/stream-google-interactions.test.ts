import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { streamGoogleInteractionEvents } from './stream-google-interactions';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const INTERACTION_ID = 'v1_test-stream-id';
const STREAM_URL = `${BASE_URL}/interactions/${INTERACTION_ID}`;
const CANCEL_URL = `${BASE_URL}/interactions/${INTERACTION_ID}/cancel`;

function sse(events: Array<Record<string, unknown>>) {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`);
}

describe('streamGoogleInteractionEvents', () => {
  const server = createTestServer({
    [STREAM_URL]: {},
    [CANCEL_URL]: {},
  });

  it('reads the SSE feed and exits when interaction.complete arrives', async () => {
    server.urls[STREAM_URL].response = {
      type: 'stream-chunks',
      chunks: sse([
        {
          event_type: 'interaction.created',
          event_id: 'evt-1',
          interaction: { id: INTERACTION_ID, status: 'in_progress' },
        },
        {
          event_type: 'step.start',
          event_id: 'evt-2',
          index: 0,
          content: { type: 'text' },
        },
        {
          event_type: 'step.delta',
          event_id: 'evt-3',
          index: 0,
          delta: { type: 'text', text: 'hello' },
        },
        {
          event_type: 'step.stop',
          event_id: 'evt-4',
          index: 0,
        },
        {
          event_type: 'interaction.completed',
          event_id: 'evt-5',
          interaction: { id: INTERACTION_ID, status: 'completed' },
        },
      ]),
    };

    const stream = streamGoogleInteractionEvents({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      retryDelayMs: 1,
    });

    const parsed = await convertReadableStreamToArray(stream);
    const eventTypes = parsed
      .filter(r => r.success)
      .map(r => (r.value as { event_type: string }).event_type);

    expect(eventTypes).toEqual([
      'interaction.created',
      'step.start',
      'step.delta',
      'step.stop',
      'interaction.completed',
    ]);
    expect(server.calls.length).toBe(1);
    expect(server.calls[0].requestUrlSearchParams.get('stream')).toBe('true');
    expect(
      server.calls[0].requestUrlSearchParams.get('last_event_id'),
    ).toBeNull();
  });

  it('reconnects with last_event_id when the stream ends without completion', async () => {
    let callIdx = 0;
    server.urls[STREAM_URL].response = () => {
      const idx = callIdx++;
      if (idx === 0) {
        return {
          type: 'stream-chunks',
          chunks: sse([
            {
              event_type: 'interaction.created',
              event_id: 'evt-1',
              interaction: { id: INTERACTION_ID, status: 'in_progress' },
            },
            {
              event_type: 'step.start',
              event_id: 'evt-2',
              index: 0,
              content: { type: 'text' },
            },
            {
              event_type: 'step.delta',
              event_id: 'evt-3',
              index: 0,
              delta: { type: 'text', text: 'first' },
            },
          ]),
        };
      }
      return {
        type: 'stream-chunks',
        chunks: sse([
          {
            event_type: 'step.delta',
            event_id: 'evt-4',
            index: 0,
            delta: { type: 'text', text: 'second' },
          },
          {
            event_type: 'step.stop',
            event_id: 'evt-5',
            index: 0,
          },
          {
            event_type: 'interaction.completed',
            event_id: 'evt-6',
            interaction: { id: INTERACTION_ID, status: 'completed' },
          },
        ]),
      };
    };

    const stream = streamGoogleInteractionEvents({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      retryDelayMs: 1,
    });

    const parsed = await convertReadableStreamToArray(stream);
    const eventTypes = parsed
      .filter(r => r.success)
      .map(r => (r.value as { event_type: string }).event_type);

    expect(eventTypes).toEqual([
      'interaction.created',
      'step.start',
      'step.delta',
      'step.delta',
      'step.stop',
      'interaction.completed',
    ]);
    expect(server.calls.length).toBe(2);
    expect(server.calls[1].requestUrlSearchParams.get('last_event_id')).toBe(
      'evt-3',
    );
  });

  it('fires POST /interactions/{id}/cancel when the abort signal fires mid-stream', async () => {
    const { TestResponseController } =
      await import('@ai-sdk/test-server/with-vitest');
    const controller = new TestResponseController();
    server.urls[STREAM_URL].response = {
      type: 'controlled-stream',
      controller,
    };
    server.urls[CANCEL_URL].response = {
      type: 'json-value',
      body: { id: INTERACTION_ID, status: 'cancelled' },
    };

    const ac = new AbortController();
    const stream = streamGoogleInteractionEvents({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      abortSignal: ac.signal,
      retryDelayMs: 1,
    });

    controller.write(
      `data: ${JSON.stringify({
        event_type: 'interaction.created',
        event_id: 'evt-1',
        interaction: { id: INTERACTION_ID, status: 'in_progress' },
      })}\n\n`,
    );

    const reader = stream.getReader();
    await reader.read(); // first event arrives
    ac.abort();

    await expect(reader.read()).rejects.toThrow();

    // Cancel POST should fire as part of the abort cleanup.
    await new Promise(resolve => setTimeout(resolve, 20));
    const cancelCalls = server.calls.filter(c => c.requestUrl === CANCEL_URL);
    expect(cancelCalls.length).toBe(1);
    expect(cancelCalls[0].requestMethod).toBe('POST');
  });

  it('does not fire cancel when the stream completes normally', async () => {
    server.urls[STREAM_URL].response = {
      type: 'stream-chunks',
      chunks: sse([
        {
          event_type: 'interaction.completed',
          event_id: 'evt-1',
          interaction: { id: INTERACTION_ID, status: 'completed' },
        },
      ]),
    };
    server.urls[CANCEL_URL].response = {
      type: 'json-value',
      body: { id: INTERACTION_ID, status: 'cancelled' },
    };

    const stream = streamGoogleInteractionEvents({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      retryDelayMs: 1,
    });

    await convertReadableStreamToArray(stream);

    const cancelCalls = server.calls.filter(c => c.requestUrl === CANCEL_URL);
    expect(cancelCalls.length).toBe(0);
  });

  it('errors out after maxRetries empty connections', async () => {
    server.urls[STREAM_URL].response = {
      type: 'stream-chunks',
      chunks: [],
    };

    const stream = streamGoogleInteractionEvents({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      maxRetries: 2,
      retryDelayMs: 1,
    });

    await expect(convertReadableStreamToArray(stream)).rejects.toThrow(
      /closed without producing any events/i,
    );
    expect(server.calls.length).toBe(2);
  });
});
