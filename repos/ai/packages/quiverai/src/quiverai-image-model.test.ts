import { APICallError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { quiveraiFailedResponseHandler } from './quiverai-image-model';

describe('quiveraiFailedResponseHandler', () => {
  it('maps QuiverAI error envelopes into API call errors', async () => {
    const response = new Response(
      JSON.stringify({
        status: 429,
        code: 'rate_limit',
        message: 'Slow down.',
        request_id: 'req_1',
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { value } = await quiveraiFailedResponseHandler({
      url: 'https://api.quiver.ai/v1/svgs/generations',
      requestBodyValues: { model: 'arrow-1' },
      response,
    });

    expect(value).toBeInstanceOf(APICallError);
    expect(value.message).toContain('Slow down.');
    expect(value.statusCode).toBe(429);
    expect(value.isRetryable).toBe(true);
    expect(value.data).toMatchObject({
      code: 'rate_limit',
      request_id: 'req_1',
    });
  });

  it('marks client errors as non-retryable', async () => {
    const response = new Response(
      JSON.stringify({
        status: 400,
        code: 'bad_request',
        message: 'Prompt is invalid.',
        request_id: 'req_2',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { value } = await quiveraiFailedResponseHandler({
      url: 'https://api.quiver.ai/v1/svgs/generations',
      requestBodyValues: { model: 'arrow-1' },
      response,
    });

    expect(value.isRetryable).toBe(false);
    expect(value.statusCode).toBe(400);
    expect(value.message).toContain('Prompt is invalid.');
  });
});
