import { APICallError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { xaiFailedResponseHandler } from './xai-error';

function makeResponse(body: object) {
  return new Response(JSON.stringify(body), {
    status: 400,
    statusText: 'Bad Request',
    headers: { 'content-type': 'application/json' },
  });
}

describe('xaiFailedResponseHandler', () => {
  it('extracts message from chat completions error shape', async () => {
    const response = makeResponse({
      error: {
        message: 'Invalid value: temperature must be between 0 and 2',
        type: 'invalid_request_error',
        code: 'invalid_value',
      },
    });

    const { value } = await xaiFailedResponseHandler({
      url: 'https://api.x.ai/v1/chat/completions',
      requestBodyValues: {},
      response,
    });

    expect(value).toBeInstanceOf(APICallError);
    expect(value.message).toBe(
      'Invalid value: temperature must be between 0 and 2',
    );
  });

  it('extracts message and code from responses api error shape', async () => {
    const response = makeResponse({
      code: 'Client specified an invalid argument',
      error:
        'Invalid request content: Each message must have at least one content element.',
    });

    const { value } = await xaiFailedResponseHandler({
      url: 'https://api.x.ai/v1/responses',
      requestBodyValues: {},
      response,
    });

    expect(value).toBeInstanceOf(APICallError);
    expect(value.message).toBe(
      'Client specified an invalid argument: Invalid request content: Each message must have at least one content element.',
    );
  });
});
