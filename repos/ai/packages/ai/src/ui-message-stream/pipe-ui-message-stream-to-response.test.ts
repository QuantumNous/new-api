import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { createMockServerResponse } from '../test/mock-server-response';
import type { TextStreamPart } from '../generate-text/stream-text-result';
import { pipeUIMessageStreamToResponse } from './pipe-ui-message-stream-to-response';
import { toUIMessageStream } from './to-ui-message-stream';
import { describe, it, expect } from 'vitest';

describe('pipeUIMessageStreamToResponse', () => {
  it('should write to ServerResponse with correct headers and encoded stream', async () => {
    const mockResponse = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: mockResponse,
      status: 200,
      statusText: 'OK',
      headers: {
        'Custom-Header': 'test',
      },
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'test-data' },
        { type: 'text-end', id: '1' },
      ]),
    });

    // Wait for the stream to finish writing
    await mockResponse.waitForEnd();

    // Verify response properties
    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.statusMessage).toBe('OK');

    // Verify headers
    expect(mockResponse.headers).toMatchInlineSnapshot(`
      {
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "content-type": "text/event-stream",
        "custom-header": "test",
        "x-accel-buffering": "no",
        "x-vercel-ai-ui-message-stream": "v1",
      }
    `);

    // Verify written data using decoded chunks
    const decodedChunks = mockResponse.getDecodedChunks();
    expect(decodedChunks).toMatchInlineSnapshot(`
      [
        "data: {"type":"text-start","id":"1"}

      ",
        "data: {"type":"text-delta","id":"1","delta":"test-data"}

      ",
        "data: {"type":"text-end","id":"1"}

      ",
        "data: [DONE]

      ",
      ]
    `);
  });

  it('should handle errors in the stream', async () => {
    const mockResponse = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: mockResponse,
      status: 200,
      stream: convertArrayToReadableStream([
        { type: 'error', errorText: 'Custom error message' },
      ]),
    });

    // Wait for the stream to finish writing
    await mockResponse.waitForEnd();

    // Verify error handling using decoded chunks
    const decodedChunks = mockResponse.getDecodedChunks();
    expect(decodedChunks).toMatchInlineSnapshot(`
      [
        "data: {"type":"error","errorText":"Custom error message"}

      ",
        "data: [DONE]

      ",
      ]
    `);
  });

  it('can pipe a stream created by toUIMessageStream', async () => {
    const mockResponse = createMockServerResponse();

    pipeUIMessageStreamToResponse({
      response: mockResponse,
      stream: toUIMessageStream({
        stream: convertArrayToReadableStream([
          { type: 'start' },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', text: 'Hello' },
          { type: 'text-end', id: 't1' },
        ] satisfies TextStreamPart<{}>[]),
        sendStart: false,
      }),
    });

    await mockResponse.waitForEnd();

    expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
      [
        "data: {"type":"text-start","id":"t1"}

      ",
        "data: {"type":"text-delta","id":"t1","delta":"Hello"}

      ",
        "data: {"type":"text-end","id":"t1"}

      ",
        "data: [DONE]

      ",
      ]
    `);
  });
});
