import { beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createTestServer as createCoreTestServer,
  TestResponseController,
  type UrlResponse,
  type UrlHandler,
  type UrlHandlers,
} from './index';
export function createTestServer<
  URLS extends {
    [url: string]: {
      response?:
        | UrlResponse
        | UrlResponse[]
        | ((options: { callNumber: number }) => UrlResponse);
    };
  },
>(
  routes: URLS,
): {
  urls: UrlHandlers<URLS>;
  calls: Array<{
    readonly requestBodyJson: Promise<any>;
    readonly requestBodyMultipart: Promise<Record<string, any> | null> | null;
    readonly requestCredentials: RequestCredentials;
    readonly requestHeaders: Record<string, string>;
    readonly requestUserAgent: string | undefined;
    readonly requestUrlSearchParams: URLSearchParams;
    readonly requestUrl: string;
    readonly requestMethod: string;
  }>;
} {
  const server = createCoreTestServer(routes);

  beforeAll(() => {
    server.server.start();
  });

  beforeEach(() => {
    server.server.reset();
  });

  afterAll(() => {
    server.server.stop();
  });

  return {
    urls: server.urls,
    get calls() {
      return server.calls;
    },
  };
}

export { TestResponseController };
export type { UrlResponse, UrlHandler, UrlHandlers };
