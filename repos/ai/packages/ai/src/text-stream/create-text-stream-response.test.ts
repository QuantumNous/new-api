import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import type { TextStreamPart } from '../generate-text/stream-text-result';
import { createTextStreamResponse } from './create-text-stream-response';
import { toTextStream } from './to-text-stream';
import { describe, it, expect } from 'vitest';

describe('createTextStreamResponse', () => {
  it('should create a Response with correct headers and encoded stream', async () => {
    const response = createTextStreamResponse({
      status: 200,
      statusText: 'OK',
      headers: {
        'Custom-Header': 'test',
      },
      stream: convertArrayToReadableStream(['test-data']),
    });

    // Verify response properties
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');

    // Verify headers
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(response.headers.get('Custom-Header')).toBe('test');

    // Verify encoded stream content
    const decoder = new TextDecoder();
    const encodedStream = response.body!;
    const chunks = await convertReadableStreamToArray(encodedStream);
    const decodedChunks = chunks.map(chunk => decoder.decode(chunk));

    expect(decodedChunks).toEqual(['test-data']);
  });

  it('can respond with a stream created by toTextStream', async () => {
    const response = createTextStreamResponse({
      stream: toTextStream({
        stream: convertArrayToReadableStream([
          { type: 'start' },
          { type: 'text-delta', id: 't1', text: 'Hello' },
          { type: 'text-delta', id: 't1', text: ', world!' },
          { type: 'text-end', id: 't1' },
        ] satisfies TextStreamPart<{}>[]),
      }),
    });

    const decoder = new TextDecoder();
    const chunks = await convertReadableStreamToArray(response.body!);

    expect(chunks.map(chunk => decoder.decode(chunk))).toEqual([
      'Hello',
      ', world!',
    ]);
  });
});
