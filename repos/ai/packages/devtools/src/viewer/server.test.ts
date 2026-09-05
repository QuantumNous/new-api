import { afterEach, describe, expect, it, vi } from 'vitest';
import { app, startViewer } from './server.js';

const { mockOn, mockServe, mockExit } = vi.hoisted(() => {
  const mockOn = vi.fn();
  return {
    mockExit: vi.fn(),
    mockOn,
    mockServe: vi.fn(() => ({ on: mockOn })),
  };
});

vi.spyOn(process, 'exit').mockImplementation(mockExit as never);

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

afterEach(() => {
  vi.clearAllMocks();
});

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

describe('viewer server errors', () => {
  it('shows a monorepo-safe command when the port is already in use', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockExit.mockImplementationOnce(() => {
      throw new Error('process exited');
    });

    startViewer();
    const errorHandler = mockOn.mock.calls[0][1];
    expect(() =>
      errorHandler(
        Object.assign(new Error('port is already in use'), {
          code: 'EADDRINUSE',
        }),
      ),
    ).toThrow('process exited');

    expect(consoleError).toHaveBeenCalledWith(
      '   AI_SDK_DEVTOOLS_PORT=4984 npx @ai-sdk/devtools@latest\n',
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
