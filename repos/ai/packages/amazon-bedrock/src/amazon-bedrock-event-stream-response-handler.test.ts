import { EmptyResponseBodyError } from '@ai-sdk/provider';
import { createAmazonBedrockEventStreamResponseHandler } from './amazon-bedrock-event-stream-response-handler';
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { z } from 'zod/v4';
import { describe, it, expect, vi, type MockInstance } from 'vitest';
// Helper that constructs a properly framed message.
// The first 4 bytes will contain the frame total length (big-endian).
const createFrame = (payload: Uint8Array): Uint8Array => {
  const totalLength = 4 + payload.length;
  const frame = new Uint8Array(totalLength);
  new DataView(frame.buffer).setUint32(0, totalLength, false);
  frame.set(payload, 4);
  return frame;
};

// Mock EventStreamCodec
vi.mock('@smithy/eventstream-codec', () => ({
  EventStreamCodec: vi.fn(function () {}),
}));

describe('createEventSourceResponseHandler', () => {
  // Define a sample schema for testing
  const testSchema = z.object({
    chunk: z.object({
      content: z.string(),
    }),
  });

  it('throws EmptyResponseBodyError when response body is null', async () => {
    const response = new Response(null);
    const handler = createAmazonBedrockEventStreamResponseHandler(testSchema);

    await expect(
      handler({
        response,
        url: 'test-url',
        requestBodyValues: {},
      }),
    ).rejects.toThrow(EmptyResponseBodyError);
  });

  it('successfully processes valid event stream data', async () => {
    // Prepare the message we wish to simulate.
    // Our decoded message will contain headers and a body that is valid JSON.
    const message = {
      headers: {
        ':message-type': { value: 'event' },
        ':event-type': { value: 'chunk' },
      },
      body: new TextEncoder().encode(
        JSON.stringify({ content: 'test message' }),
      ),
    };

    // Create a frame that properly encapsulates the message.
    const dummyPayload = new Uint8Array([1, 2, 3, 4]); // arbitrary payload that makes the length check pass
    const frame = createFrame(dummyPayload);

    const mockDecode = vi.fn().mockReturnValue(message);
    (EventStreamCodec as unknown as MockInstance).mockImplementation(
      function () {
        return { decode: mockDecode };
      },
    );

    // Create a stream that enqueues the complete frame.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(frame);
        controller.close();
      },
    });

    const response = new Response(stream);
    const handler = createAmazonBedrockEventStreamResponseHandler(testSchema);
    const result = await handler({
      response,
      url: 'test-url',
      requestBodyValues: {},
    });

    const reader = result.value.getReader();
    const { done, value } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({
      success: true,
      value: { chunk: { content: 'test message' } },
      rawValue: { chunk: { content: 'test message' } },
    });
  });

  it('handles invalid JSON data', async () => {
    // Our mock decode returns a body that is not valid JSON.
    const message = {
      headers: {
        ':message-type': { value: 'event' },
        ':event-type': { value: 'chunk' },
      },
      body: new TextEncoder().encode('invalid json'),
    };

    const dummyPayload = new Uint8Array([5, 6, 7, 8]);
    const frame = createFrame(dummyPayload);

    const mockDecode = vi.fn().mockReturnValue(message);
    (EventStreamCodec as unknown as MockInstance).mockImplementation(
      function () {
        return { decode: mockDecode };
      },
    );

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(frame);
        controller.close();
      },
    });

    const response = new Response(stream);
    const handler = createAmazonBedrockEventStreamResponseHandler(testSchema);
    const result = await handler({
      response,
      url: 'test-url',
      requestBodyValues: {},
    });

    const reader = result.value.getReader();
    const { done, value } = await reader.read();

    expect(done).toBe(false);
    // When JSON is invalid, safeParseJSON returns a result with success: false.
    expect(value?.success).toBe(false);
    expect((value as { success: false; error: Error }).error).toBeDefined();
  });

  it('handles schema validation failures', async () => {
    // The decoded message returns valid JSON but that does not meet our schema.
    const message = {
      headers: {
        ':message-type': { value: 'event' },
        ':event-type': { value: 'chunk' },
      },
      body: new TextEncoder().encode(JSON.stringify({ invalid: 'data' })),
    };

    const dummyPayload = new Uint8Array([9, 10, 11, 12]);
    const frame = createFrame(dummyPayload);

    const mockDecode = vi.fn().mockReturnValue(message);
    (EventStreamCodec as unknown as MockInstance).mockImplementation(
      function () {
        return { decode: mockDecode };
      },
    );

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(frame);
        controller.close();
      },
    });

    const response = new Response(stream);
    const handler = createAmazonBedrockEventStreamResponseHandler(testSchema);
    const result = await handler({
      response,
      url: 'test-url',
      requestBodyValues: {},
    });

    const reader = result.value.getReader();
    const { done, value } = await reader.read();

    expect(done).toBe(false);
    // The schema does not match so safeParseJSON with the schema should yield success: false.
    expect(value?.success).toBe(false);
    expect((value as { success: false; error: Error }).error).toBeDefined();
  });

  it('handles partial messages correctly', async () => {
    // In this test, we simulate a partial message followed by a complete one.
    // The first invocation of decode will throw an error (simulated incomplete message),
    // and the subsequent invocation returns a valid event.
    const message = {
      headers: {
        ':message-type': { value: 'event' },
        ':event-type': { value: 'chunk' },
      },
      body: new TextEncoder().encode(
        JSON.stringify({ content: 'complete message' }),
      ),
    };

    const dummyPayload1 = new Uint8Array([13, 14]); // too short, part of a frame
    const frame1 = createFrame(dummyPayload1);
    const dummyPayload2 = new Uint8Array([15, 16, 17, 18]);
    const frame2 = createFrame(dummyPayload2);

    const mockDecode = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Incomplete data');
      })
      .mockReturnValue(message);
    (EventStreamCodec as unknown as MockInstance).mockImplementation(
      function () {
        return { decode: mockDecode };
      },
    );

    const stream = new ReadableStream({
      start(controller) {
        // Send first, incomplete frame (decode will throw error).
        controller.enqueue(frame1);
        // Then send a proper frame.
        controller.enqueue(frame2);
        controller.close();
      },
    });

    const response = new Response(stream);
    const handler = createAmazonBedrockEventStreamResponseHandler(testSchema);
    const result = await handler({
      response,
      url: 'test-url',
      requestBodyValues: {},
    });

    const reader = result.value.getReader();
    const { done, value } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({
      success: true,
      value: { chunk: { content: 'complete message' } },
      rawValue: { chunk: { content: 'complete message' } },
    });
  });
});
