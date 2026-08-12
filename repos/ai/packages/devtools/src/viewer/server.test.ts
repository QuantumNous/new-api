import { describe, expect, it, vi } from 'vitest';
import { app, startViewer } from './server.js';

const { mockOn, mockServe } = vi.hoisted(() => {
  const mockOn = vi.fn();
  return {
    mockOn,
    mockServe: vi.fn(() => ({ on: mockOn })),
  };
});

vi.mock('@hono/node-server', () => ({
  serve: mockServe,
}));

vi.mock('../db.js', () => ({
  getRuns: vi.fn(async () => []),
  getRunWithSteps: vi.fn(),
  getStepsForRun: vi.fn(async () => []),
  clearDatabase: vi.fn(),
  reloadDb: vi.fn(),
}));

describe('viewer server security', () => {
  it('serves API requests from the local viewer without wildcard CORS', async () => {
    const response = await app.request('http://localhost:4983/api/runs', {
      headers: {
        host: 'localhost:4983',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    await expect(response.json()).resolves.toEqual([]);
  });

  it('rejects cross-origin API requests from other sites', async () => {
    const response = await app.request('http://localhost:4983/api/runs', {
      headers: {
        host: 'localhost:4983',
        origin: 'https://example.com',
      },
    });

    expect(response.status).toBe(403);
  });

  it('rejects API requests for non-local hosts', async () => {
    const response = await app.request('http://192.0.2.10:4983/api/runs', {
      headers: {
        host: '192.0.2.10:4983',
      },
    });

    expect(response.status).toBe(403);
  });

  it('binds the viewer to localhost', () => {
    startViewer();

    expect(mockServe).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 4983,
        hostname: 'localhost',
      }),
      expect.any(Function),
    );
  });
});
