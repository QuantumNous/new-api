import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { pollGoogleInteractionUntilTerminal } from './poll-google-interactions';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const INTERACTION_ID = 'v1_test-poll-id';
const GET_URL = `${BASE_URL}/interactions/${INTERACTION_ID}`;
const CANCEL_URL = `${BASE_URL}/interactions/${INTERACTION_ID}/cancel`;

describe('pollGoogleInteractionUntilTerminal', () => {
  const server = createTestServer({
    [GET_URL]: {},
    [CANCEL_URL]: {},
  });

  it('polls until terminal status and returns the final response', async () => {
    server.urls[GET_URL].response = [
      {
        type: 'json-value',
        body: { id: INTERACTION_ID, status: 'in_progress' },
      },
      {
        type: 'json-value',
        body: { id: INTERACTION_ID, status: 'in_progress' },
      },
      {
        type: 'json-value',
        body: {
          id: INTERACTION_ID,
          status: 'completed',
          outputs: [{ type: 'text', text: 'final answer' }],
          usage: { total_input_tokens: 5, total_output_tokens: 7 },
        },
      },
    ];

    const result = await pollGoogleInteractionUntilTerminal({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      initialDelayMs: 1,
      maxDelayMs: 1,
      timeoutMs: 5000,
    });

    expect(result.response.status).toBe('completed');
    expect(result.response.outputs).toEqual([
      { type: 'text', text: 'final answer' },
    ]);
    expect(server.calls.length).toBe(3);
    expect(server.calls.every(c => c.requestMethod === 'GET')).toBe(true);
  });

  it('returns immediately on the first call if status is already terminal', async () => {
    server.urls[GET_URL].response = {
      type: 'json-value',
      body: { id: INTERACTION_ID, status: 'completed', outputs: [] },
    };

    const result = await pollGoogleInteractionUntilTerminal({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      initialDelayMs: 1,
      maxDelayMs: 1,
      timeoutMs: 5000,
    });

    expect(result.response.status).toBe('completed');
    expect(server.calls.length).toBe(1);
  });

  it('aborts polling when abortSignal fires', async () => {
    server.urls[GET_URL].response = {
      type: 'json-value',
      body: { id: INTERACTION_ID, status: 'in_progress' },
    };
    server.urls[CANCEL_URL].response = {
      type: 'json-value',
      body: { id: INTERACTION_ID, status: 'cancelled' },
    };

    const ac = new AbortController();
    const promise = pollGoogleInteractionUntilTerminal({
      baseURL: BASE_URL,
      interactionId: INTERACTION_ID,
      headers: {},
      abortSignal: ac.signal,
      initialDelayMs: 50,
      maxDelayMs: 50,
      timeoutMs: 5000,
    });

    setTimeout(() => ac.abort(), 10);

    await expect(promise).rejects.toThrow(/abort/i);

    const cancelCalls = server.calls.filter(c => c.requestUrl === CANCEL_URL);
    expect(cancelCalls.length).toBe(1);
    expect(cancelCalls[0].requestMethod).toBe('POST');
  });

  it('throws when no interaction id is provided', async () => {
    await expect(
      pollGoogleInteractionUntilTerminal({
        baseURL: BASE_URL,
        interactionId: undefined,
        headers: {},
      }),
    ).rejects.toThrow(/cannot poll/i);
  });

  it('throws when timeout is exceeded', async () => {
    server.urls[GET_URL].response = {
      type: 'json-value',
      body: { id: INTERACTION_ID, status: 'in_progress' },
    };

    await expect(
      pollGoogleInteractionUntilTerminal({
        baseURL: BASE_URL,
        interactionId: INTERACTION_ID,
        headers: {},
        initialDelayMs: 5,
        maxDelayMs: 5,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/timed out/i);
  });
});
