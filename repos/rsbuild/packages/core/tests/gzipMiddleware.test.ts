import { createServer } from 'node:http';
import { gzipMiddleware } from '../src/server/gzipMiddleware';
import type { Server } from 'node:http';

const closeServer = (server: Server) => {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const listen = (server: Server) => {
  return new Promise<number>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        resolve(address.port);
      }
    });
  });
};

test('should support raw header arrays passed to writeHead', async () => {
  const server = createServer((req, res) => {
    gzipMiddleware()(req, res, () => {
      res.writeHead(200, 'OK', [
        'Content-Type',
        'text/plain; charset=utf-8',
        'X-Test-Header',
        'ok',
      ]);
      res.end('hello '.repeat(300));
    });
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://localhost:${port}`, {
      headers: {
        'accept-encoding': 'gzip',
      },
    });
    await response.text();

    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('x-test-header')).toBe('ok');
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('0')).toBeNull();
    expect(response.headers.get('1')).toBeNull();
  } finally {
    await closeServer(server);
  }
});

test('should preserve set-cookie entries from raw header arrays', async () => {
  const server = createServer((req, res) => {
    gzipMiddleware()(req, res, () => {
      res.writeHead(200, 'OK', [
        'Content-Type',
        'text/plain; charset=utf-8',
        'Set-Cookie',
        'a=1',
        'Set-Cookie',
        'b=2',
      ]);
      res.end('hello '.repeat(300));
    });
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://localhost:${port}`, {
      headers: {
        'accept-encoding': 'gzip',
      },
    });
    await response.text();

    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  } finally {
    await closeServer(server);
  }
});

test('should remove writeHead compression headers when response is gzipped', async () => {
  const server = createServer((req, res) => {
    gzipMiddleware()(req, res, () => {
      res.writeHead(200, 'OK', [
        'Content-Type',
        'text/plain; charset=utf-8',
        'Content-Length',
        '1800',
      ]);
      res.end('hello '.repeat(300));
    });
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://localhost:${port}`, {
      headers: {
        'accept-encoding': 'gzip',
      },
    });
    await response.text();

    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('content-length')).toBeNull();
  } finally {
    await closeServer(server);
  }
});

test('should not compress responses with writeHead content-encoding', async () => {
  const server = createServer((req, res) => {
    gzipMiddleware()(req, res, () => {
      res.writeHead(200, 'OK', [
        'Content-Type',
        'text/plain; charset=utf-8',
        'Content-Encoding',
        'identity',
      ]);
      res.end('hello '.repeat(300));
    });
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://localhost:${port}`, {
      headers: {
        'accept-encoding': 'gzip',
      },
    });
    await response.text();

    expect(response.headers.get('content-encoding')).toBe('identity');
  } finally {
    await closeServer(server);
  }
});

test('should not compress responses without content-type', async () => {
  const server = createServer((req, res) => {
    gzipMiddleware()(req, res, () => {
      res.end('hello '.repeat(300));
    });
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://localhost:${port}`, {
      headers: {
        'accept-encoding': 'gzip',
      },
    });
    const text = await response.text();

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-type')).toBeNull();
    expect(text).toBe('hello '.repeat(300));
  } finally {
    await closeServer(server);
  }
});

test('should not compress text/event-stream responses', async () => {
  const server = createServer((req, res) => {
    gzipMiddleware()(req, res, () => {
      res.writeHead(200, 'OK', [
        'Content-Type',
        'text/event-stream; charset=utf-8',
        'Cache-Control',
        'no-cache',
      ]);
      res.end('data: hello\n\n');
    });
  });

  const port = await listen(server);

  try {
    const response = await fetch(`http://localhost:${port}`, {
      headers: {
        'accept-encoding': 'gzip',
      },
    });
    const text = await response.text();

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(text).toBe('data: hello\n\n');
  } finally {
    await closeServer(server);
  }
});
