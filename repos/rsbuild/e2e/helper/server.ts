import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import type { RequestHandler } from '@rsbuild/core';
import type { Context } from 'hono';

export const createConnectHandler = (middlewares: RequestHandler) => {
  return ({ env }: Context) => {
    middlewares(env.incoming, env.outgoing, (error) => {
      if (env.outgoing.writableEnded) {
        return;
      }
      env.outgoing.statusCode = error ? 500 : 404;
      env.outgoing.end(error ? String(error) : 'Not Found');
    });
    return RESPONSE_ALREADY_SENT;
  };
};
