import { describe, it, expect } from 'vitest';
import { createTestServer, TestResponseController } from './with-vitest';

describe('createTestServer', () => {
  it('should create a test server with basic functionality', () => {
    const server = createTestServer({
      'https://api.example.com/test': {
        response: {
          type: 'json-value',
          body: { message: 'hello world' },
        },
      },
    });

    expect(server).toBeDefined();
    expect(server.urls).toBeDefined();
    expect(server.calls).toBeDefined();
    expect(Array.isArray(server.calls)).toBe(true);
    expect(server.calls.length).toBe(0);
  });

  it('should handle response mutations', () => {
    const server = createTestServer({
      'https://api.example.com/test': {
        response: {
          type: 'json-value',
          body: { count: 1 },
        },
      },
    });

    // Should be able to mutate responses
    server.urls['https://api.example.com/test'].response = {
      type: 'json-value',
      body: { count: 2 },
    };

    expect(server.urls['https://api.example.com/test'].response).toEqual({
      type: 'json-value',
      body: { count: 2 },
    });
  });

  it('should support different response types', () => {
    const server = createTestServer({
      'https://api.example.com/json': {
        response: {
          type: 'json-value',
          body: { test: true },
        },
      },
      'https://api.example.com/stream': {
        response: {
          type: 'stream-chunks',
          chunks: ['chunk1', 'chunk2'],
        },
      },
      'https://api.example.com/error': {
        response: {
          type: 'error',
          status: 400,
          body: 'Bad Request',
        },
      },
    });

    expect(server.urls['https://api.example.com/json'].response).toEqual({
      type: 'json-value',
      body: { test: true },
    });

    expect(server.urls['https://api.example.com/stream'].response).toEqual({
      type: 'stream-chunks',
      chunks: ['chunk1', 'chunk2'],
    });

    expect(server.urls['https://api.example.com/error'].response).toEqual({
      type: 'error',
      status: 400,
      body: 'Bad Request',
    });
  });
});

describe('TestResponseController', () => {
  it('should create a controller with stream access', () => {
    const controller = new TestResponseController();

    expect(controller).toBeDefined();
    expect(controller.stream).toBeDefined();
    expect(controller.stream).toBeInstanceOf(ReadableStream);
  });

  it('should have write, error, and close methods', () => {
    const controller = new TestResponseController();

    expect(typeof controller.write).toBe('function');
    expect(typeof controller.error).toBe('function');
    expect(typeof controller.close).toBe('function');
  });
});
