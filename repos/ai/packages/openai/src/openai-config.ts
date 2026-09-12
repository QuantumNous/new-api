import type {
  FetchFunction,
  WebSocketConstructor,
} from '@ai-sdk/provider-utils';

export type OpenAIConfig = {
  provider: string;
  url: (options: { modelId: string; path: string }) => string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  webSocket?: WebSocketConstructor;
  generateId?: () => string;
  /**
   * This is soft-deprecated. Use provider references (e.g. `{ openai: 'file-abc123' }`)
   * in file part data instead. File ID prefixes used to identify file IDs
   * in Responses API. When undefined, all string file data is treated as
   * base64 content.
   *
   * TODO: remove in v8
   */
  fileIdPrefixes?: readonly string[];
};
