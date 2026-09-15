import type { Server } from 'node:http';
import type { Http2SecureServer, Http2ServerRequest, Http2ServerResponse } from 'node:http2';
import type { Connect, ServerConfig } from '../types';

export const createHttpServer = async ({
  serverConfig,
  middlewares,
}: {
  serverConfig: ServerConfig;
  middlewares: Connect.Server;
}): Promise<Http2SecureServer | Server> => {
  if (serverConfig.https) {
    const { createSecureServer } = await import('node:http2');
    return createSecureServer(
      {
        // Keep HTTP/1 clients working
        allowHTTP1: true,
        // increase the maximum memory (MiB)
        maxSessionMemory: 1024,
        ...serverConfig.https,
      },
      middlewares as unknown as (req: Http2ServerRequest, res: Http2ServerResponse) => void,
    );
  }

  const { createServer } = await import('node:http');
  return createServer(middlewares);
};
