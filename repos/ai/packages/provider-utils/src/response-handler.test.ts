import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { DEFAULT_MAX_DOWNLOAD_SIZE } from './read-response-with-size-limit';
import {
  createJsonErrorResponseHandler,
  createBinaryResponseHandler,
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
} from './response-handler';

function createOversizedResponse({
  body = '{}',
  status = 200,
  statusText,
}: {
  body?: string;
  status?: number;
  statusText?: string;
} = {}) {
  let cancelled = false;

  return {
    response: new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body));
        },
        cancel() {
          cancelled = true;
        },
      }),
      {
        status,
        statusText,
        headers: {
          'content-length': String(DEFAULT_MAX_DOWNLOAD_SIZE + 1),
        },
      },
    ),
    cancelled: () => cancelled,
  };
}

describe('createJsonResponseHandler', () => {
  it('should return both parsed value and rawValue', async () => {
    const responseSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const rawData = {
      name: 'John',
      age: 30,
      extraField: 'ignored',
    };

    const response = new Response(JSON.stringify(rawData));
    const handler = createJsonResponseHandler(responseSchema);

    const result = await handler({
      url: 'test-url',
      requestBodyValues: {},
      response,
    });

    expect(result.value).toEqual({
      name: 'John',
      age: 30,
    });
    expect(result.rawValue).toEqual(rawData);
  });

  it('should reject oversized responses before reading the body', async () => {
    const { response, cancelled } = createOversizedResponse();
    const handler = createJsonResponseHandler(z.object({}));

    await expect(
      handler({
        url: 'test-url',
        requestBodyValues: {},
        response,
      }),
    ).rejects.toThrow('exceeded maximum size');

    expect(cancelled()).toBe(true);
  });
});

describe('createJsonErrorResponseHandler', () => {
  it('should reject oversized responses before reading the body', async () => {
    const { response, cancelled } = createOversizedResponse({
      body: JSON.stringify({ error: 'too large' }),
      status: 500,
      statusText: 'Internal Server Error',
    });
    const handler = createJsonErrorResponseHandler({
      errorSchema: z.object({ error: z.string() }),
      errorToMessage: error => error.error,
    });

    await expect(
      handler({
        url: 'test-url',
        requestBodyValues: {},
        response,
      }),
    ).rejects.toThrow('exceeded maximum size');

    expect(cancelled()).toBe(true);
  });
});

describe('createBinaryResponseHandler', () => {
  it('should handle binary response successfully', async () => {
    const binaryData = new Uint8Array([1, 2, 3, 4]);
    const response = new Response(binaryData);
    const handler = createBinaryResponseHandler();

    const result = await handler({
      url: 'test-url',
      requestBodyValues: {},
      response,
    });

    expect(result.value).toBeInstanceOf(Uint8Array);
    expect(result.value).toEqual(binaryData);
  });

  it('should throw APICallError when response body is null', async () => {
    const response = new Response(null);
    const handler = createBinaryResponseHandler();

    await expect(
      handler({
        url: 'test-url',
        requestBodyValues: {},
        response,
      }),
    ).rejects.toThrow('Response body is empty');
  });
});

describe('createStatusCodeErrorResponseHandler', () => {
  it('should create error with status text and response body', async () => {
    const response = new Response('Error message', {
      status: 404,
      statusText: 'Not Found',
    });
    const handler = createStatusCodeErrorResponseHandler();

    const result = await handler({
      url: 'test-url',
      requestBodyValues: { some: 'data' },
      response,
    });

    expect(result.value.message).toBe('Not Found');
    expect(result.value.statusCode).toBe(404);
    expect(result.value.responseBody).toBe('Error message');
    expect(result.value.url).toBe('test-url');
    expect(result.value.requestBodyValues).toEqual({ some: 'data' });
  });

  it('should reject oversized responses before reading the body', async () => {
    const { response, cancelled } = createOversizedResponse({
      body: 'too large',
      status: 500,
      statusText: 'Internal Server Error',
    });
    const handler = createStatusCodeErrorResponseHandler();

    await expect(
      handler({
        url: 'test-url',
        requestBodyValues: { some: 'data' },
        response,
      }),
    ).rejects.toThrow('exceeded maximum size');

    expect(cancelled()).toBe(true);
  });
});
