import type {
  FetchFunction,
  WebSocketConstructor,
} from '@ai-sdk/provider-utils';

export type CartesiaConfig = {
  provider: string;
  url: (options: { modelId: string; path: string }) => string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  version?: string;
  webSocket?: WebSocketConstructor;
  generateId?: () => string;
};
