import { createAmazonBedrockAnthropicFetch } from './amazon-bedrock-anthropic-fetch';
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { toUtf8, fromUtf8 } from '@smithy/util-utf8';
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { describe, it, expect, vi } from 'vitest';

describe('createAmazonBedrockAnthropicFetch', () => {
  function createMockResponse(
    body: ReadableStream<Uint8Array> | null,
    contentType: string,
  ): Response {
    return new Response(body, {
      headers: { 'content-type': contentType },
    });
  }

  function createMockFetch(
    response: Response,
  ): (url: RequestInfo | URL, options?: RequestInit) => Promise<Response> {
    return vi.fn().mockResolvedValue(response);
  }

  it('should pass through non-streaming responses unchanged', async () => {
    const jsonBody = JSON.stringify({ id: 'msg_123', content: [] });
    const mockResponse = new Response(jsonBody, {
      headers: { 'content-type': 'application/json' },
    });
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toBe(jsonBody);
  });

  it('should transform Bedrock event stream to SSE format', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    // Create a mock Anthropic event
    const anthropicEvent = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello' },
    });

    // Encode as Bedrock chunk with base64 bytes
    const chunkPayload = JSON.stringify({
      bytes: btoa(anthropicEvent),
    });

    // Create Bedrock event stream message
    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'chunk' },
      },
      body: fromUtf8(chunkPayload),
    });

    // Create a readable stream from the event
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(amazonBedrockEvent);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    expect(response.headers.get('content-type')).toBe('text/event-stream');

    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toBe(`data: ${anthropicEvent}\n\n`);
  });

  it('should handle messageStop event and emit [DONE]', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'messageStop' },
      },
      body: fromUtf8('{}'),
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(amazonBedrockEvent);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toBe('data: [DONE]\n\n');
  });

  it('should handle exception messages', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    const errorData = JSON.stringify({ message: 'Rate limit exceeded' });
    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'exception' },
        ':exception-type': { type: 'string', value: 'ThrottlingException' },
      },
      body: fromUtf8(errorData),
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(amazonBedrockEvent);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toBe(
      `data: ${JSON.stringify({ type: 'error', error: errorData })}\n\n`,
    );
  });

  it('should handle multiple events in sequence', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    const event1 = JSON.stringify({
      type: 'message_start',
      message: { id: 'msg_123' },
    });
    const event2 = JSON.stringify({
      type: 'content_block_delta',
      delta: { text: 'Hi' },
    });

    const chunk1 = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'chunk' },
      },
      body: fromUtf8(JSON.stringify({ bytes: btoa(event1) })),
    });

    const chunk2 = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'chunk' },
      },
      body: fromUtf8(JSON.stringify({ bytes: btoa(event2) })),
    });

    const stopEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'messageStop' },
      },
      body: fromUtf8('{}'),
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.enqueue(stopEvent);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});
    const reader = response.body!.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    const fullText = chunks.join('');
    expect(fullText).toContain(`data: ${event1}\n\n`);
    expect(fullText).toContain(`data: ${event2}\n\n`);
    expect(fullText).toContain('data: [DONE]\n\n');
  });

  it('should handle chunked event data spanning multiple network chunks', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    const anthropicEvent = JSON.stringify({
      type: 'content_block_delta',
      delta: { text: 'Hello World' },
    });

    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'chunk' },
      },
      body: fromUtf8(JSON.stringify({ bytes: btoa(anthropicEvent) })),
    });

    // Split the event into two chunks to simulate network fragmentation
    const midpoint = Math.floor(amazonBedrockEvent.length / 2);
    const firstHalf = amazonBedrockEvent.slice(0, midpoint);
    const secondHalf = amazonBedrockEvent.slice(midpoint);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(firstHalf);
        controller.enqueue(secondHalf);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});
    const reader = response.body!.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(new TextDecoder().decode(value));
      }
    }

    const fullText = chunks.join('');
    expect(fullText).toBe(`data: ${anthropicEvent}\n\n`);
  });

  it('should preserve response status and statusText', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'messageStop' },
      },
      body: fromUtf8('{}'),
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(amazonBedrockEvent);
        controller.close();
      },
    });

    const mockResponse = new Response(stream, {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/vnd.amazon.eventstream' },
    });
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
  });

  it('should handle chunk events with missing bytes field', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    // Create a chunk without a bytes field - this should fall back to emitting raw data
    const chunkPayload = JSON.stringify({
      someOtherField: 'value',
    });

    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'chunk' },
      },
      body: fromUtf8(chunkPayload),
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(amazonBedrockEvent);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    // Should emit the raw payload data as fallback
    expect(text).toBe(`data: ${chunkPayload}\n\n`);
  });

  it('should transform Bedrock error with message into Anthropic error format', async () => {
    const errorBody = JSON.stringify({
      message: 'cache_control: Extra inputs are not permitted',
    });
    const mockResponse = new Response(errorBody, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
    });
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    expect(response.status).toBe(400);
    expect(response.statusText).toBe('Bad Request');
    const body = JSON.parse(await response.text());
    expect(body).toEqual({
      type: 'error',
      error: {
        type: 'error',
        message: 'cache_control: Extra inputs are not permitted',
      },
    });
  });

  it('should transform Bedrock error with extra fields into Anthropic error format', async () => {
    const errorBody = JSON.stringify({
      message: 'tools.0.custom.input_schema.type: Field required',
      someOtherField: 'value',
    });
    const mockResponse = new Response(errorBody, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
    });
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    const body = JSON.parse(await response.text());
    expect(body.error.message).toBe(
      'tools.0.custom.input_schema.type: Field required',
    );
  });

  it('should use raw text as message when Bedrock error has no message field', async () => {
    const errorBody = JSON.stringify({ code: 'ValidationException' });
    const mockResponse = new Response(errorBody, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
    });
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    const body = JSON.parse(await response.text());
    expect(body.error.message).toBe(errorBody);
  });

  it('should use raw text as message when Bedrock error is not valid JSON', async () => {
    const errorBody = 'Internal Server Error';
    const mockResponse = new Response(errorBody, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/plain' },
    });
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});

    expect(response.status).toBe(500);
    const body = JSON.parse(await response.text());
    expect(body.error.message).toBe('Internal Server Error');
  });

  it('should correctly decode multi-byte UTF-8 characters (emoji and non-Latin scripts)', async () => {
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    // Create an event with multi-byte UTF-8 characters that would be corrupted by atob()
    const anthropicEvent = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello! 👋🌍 Привет 你好 مرحبا' },
    });

    // Properly encode the UTF-8 string to base64 (this is what Bedrock sends)
    const utf8Bytes = new TextEncoder().encode(anthropicEvent);
    const base64Event = convertUint8ArrayToBase64(utf8Bytes);

    const chunkPayload = JSON.stringify({
      bytes: base64Event,
    });

    const amazonBedrockEvent = codec.encode({
      headers: {
        ':message-type': { type: 'string', value: 'event' },
        ':event-type': { type: 'string', value: 'chunk' },
      },
      body: fromUtf8(chunkPayload),
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(amazonBedrockEvent);
        controller.close();
      },
    });

    const mockResponse = createMockResponse(
      stream,
      'application/vnd.amazon.eventstream',
    );
    const baseFetch = createMockFetch(mockResponse);
    const wrappedFetch = createAmazonBedrockAnthropicFetch(baseFetch);

    const response = await wrappedFetch('https://example.com', {});
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    // Verify the output matches the original event with all UTF-8 characters intact
    expect(text).toBe(`data: ${anthropicEvent}\n\n`);

    // Also verify specific characters are present and not corrupted
    expect(text).toContain('👋');
    expect(text).toContain('🌍');
    expect(text).toContain('Привет');
    expect(text).toContain('你好');
    expect(text).toContain('مرحبا');
  });
});
