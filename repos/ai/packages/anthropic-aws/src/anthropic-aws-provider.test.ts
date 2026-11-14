import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnthropicAws } from './anthropic-aws-provider';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

vi.mock('aws4fetch', () => {
  class MockAwsV4Signer {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
    async sign() {
      const headers = new Headers();
      headers.set('x-amz-date', '20240315T000000Z');
      headers.set('authorization', 'AWS4-HMAC-SHA256 Credential=test');
      return { headers };
    }
  }
  return { AwsV4Signer: MockAwsV4Signer };
});

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const createSuccessfulResponse = () =>
  new Response(
    JSON.stringify({
      type: 'message',
      id: 'msg_123',
      model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text: 'Hi' }],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const createFetchMock = () =>
  vi.fn().mockResolvedValue(createSuccessfulResponse());

const stubDefaultEnv = () => {
  vi.stubEnv('AWS_REGION', 'us-west-2');
  vi.stubEnv('ANTHROPIC_AWS_WORKSPACE_ID', 'wrkspc_default');
  vi.stubEnv('ANTHROPIC_AWS_API_KEY', undefined);
  vi.stubEnv('AWS_ACCESS_KEY_ID', undefined);
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', undefined);
  vi.stubEnv('AWS_SESSION_TOKEN', undefined);
};

describe('createAnthropicAws', () => {
  describe('baseURL configuration', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      stubDefaultEnv();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('uses the default Claude Platform on AWS base URL with region templating', async () => {
      const fetchMock = createFetchMock();
      const provider = createAnthropicAws({
        region: 'us-east-1',
        workspaceId: 'wrkspc_test',
        apiKey: 'test-api-key',
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [requestUrl] = fetchMock.mock.calls[0]!;
      expect(requestUrl).toBe(
        'https://aws-external-anthropic.us-east-1.api.aws/v1/messages',
      );
    });

    it('reads AWS_REGION from the environment when region option is omitted', async () => {
      vi.stubEnv('AWS_REGION', 'eu-west-1');
      const fetchMock = createFetchMock();
      const provider = createAnthropicAws({
        workspaceId: 'wrkspc_test',
        apiKey: 'test-api-key',
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      const [requestUrl] = fetchMock.mock.calls[0]!;
      expect(requestUrl).toBe(
        'https://aws-external-anthropic.eu-west-1.api.aws/v1/messages',
      );
    });

    it('prefers the baseURL option over the default template', async () => {
      const fetchMock = createFetchMock();
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
        apiKey: 'test-api-key',
        baseURL: 'https://proxy.example.com/v1/',
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      const [requestUrl] = fetchMock.mock.calls[0]!;
      expect(requestUrl).toBe('https://proxy.example.com/v1/messages');
    });
  });
});

describe('anthropicAws provider - authentication', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('apiKey option', () => {
    it('sends x-api-key header when apiKey is provided', async () => {
      const fetchMock = createFetchMock();
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
        apiKey: 'sk-aws-platform-key',
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      const [, requestOptions] = fetchMock.mock.calls[0]!;
      expect(requestOptions.headers['x-api-key']).toBe('sk-aws-platform-key');
      expect(requestOptions.headers.authorization).toBeUndefined();
    });

    it('reads apiKey from ANTHROPIC_AWS_API_KEY when option is omitted', async () => {
      vi.stubEnv('ANTHROPIC_AWS_API_KEY', 'sk-from-env');
      const fetchMock = createFetchMock();
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      const [, requestOptions] = fetchMock.mock.calls[0]!;
      expect(requestOptions.headers['x-api-key']).toBe('sk-from-env');
    });
  });

  describe('SigV4 path', () => {
    it('signs requests with SigV4 when apiKey is not provided', async () => {
      const fetchMock = createFetchMock();
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
        accessKeyId: 'akid',
        secretAccessKey: 'secret',
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      const [, requestOptions] = fetchMock.mock.calls[0]!;
      expect(requestOptions.headers.authorization).toBe(
        'AWS4-HMAC-SHA256 Credential=test',
      );
      expect(requestOptions.headers['x-amz-date']).toBe('20240315T000000Z');
      expect(requestOptions.headers['x-api-key']).toBeUndefined();
    });

    it('honors a credentialProvider for dynamic SigV4 credentials', async () => {
      const fetchMock = createFetchMock();
      const credentialProvider = vi.fn().mockResolvedValue({
        accessKeyId: 'dynamic-akid',
        secretAccessKey: 'dynamic-secret',
        sessionToken: 'dynamic-session',
      });
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
        credentialProvider,
        fetch: fetchMock,
      });

      await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

      expect(credentialProvider).toHaveBeenCalled();
    });

    it('throws a guided error when SigV4 credentials are missing', async () => {
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
      });

      await expect(
        provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT }),
      ).rejects.toThrow(/AWS SigV4 authentication requires AWS credentials/);
    });

    it('wraps credentialProvider rejections with a guided message', async () => {
      const provider = createAnthropicAws({
        region: 'us-west-2',
        workspaceId: 'wrkspc_test',
        credentialProvider: async () => {
          throw new Error('STS denied');
        },
      });

      await expect(
        provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT }),
      ).rejects.toThrow(/AWS credential provider failed: STS denied/);
    });
  });
});

describe('anthropicAws provider - workspaceId', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the anthropic-version header on every request', async () => {
    const fetchMock = createFetchMock();
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
      fetch: fetchMock,
    });

    await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

    const [, requestOptions] = fetchMock.mock.calls[0]!;
    expect(requestOptions.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('sends the anthropic-workspace-id header on every request', async () => {
    const fetchMock = createFetchMock();
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_unique',
      apiKey: 'test-api-key',
      fetch: fetchMock,
    });

    await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

    const [, requestOptions] = fetchMock.mock.calls[0]!;
    expect(requestOptions.headers['anthropic-workspace-id']).toBe(
      'wrkspc_unique',
    );
  });

  it('reads workspaceId from ANTHROPIC_AWS_WORKSPACE_ID when option is omitted', async () => {
    vi.stubEnv('ANTHROPIC_AWS_WORKSPACE_ID', 'wrkspc_from_env');
    const fetchMock = createFetchMock();
    const provider = createAnthropicAws({
      region: 'us-west-2',
      apiKey: 'test-api-key',
      fetch: fetchMock,
    });

    await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

    const [, requestOptions] = fetchMock.mock.calls[0]!;
    expect(requestOptions.headers['anthropic-workspace-id']).toBe(
      'wrkspc_from_env',
    );
  });

  it('throws when workspaceId is not resolvable at request time', async () => {
    vi.stubEnv('ANTHROPIC_AWS_WORKSPACE_ID', undefined);
    const fetchMock = createFetchMock();
    const provider = createAnthropicAws({
      region: 'us-west-2',
      apiKey: 'test-api-key',
      fetch: fetchMock,
    });

    await expect(
      provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT }),
    ).rejects.toThrow(/workspace/i);
  });
});

describe('anthropicAws provider - region', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when region is not resolvable at model creation time', () => {
    vi.stubEnv('AWS_REGION', undefined);
    const provider = createAnthropicAws({
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });
    expect(() => provider('claude-sonnet-4-6')).toThrow(/region/i);
  });
});

describe('anthropicAws provider - headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('merges custom headers with the workspace-id header', async () => {
    const fetchMock = createFetchMock();
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
      headers: { 'x-custom': 'value' },
      fetch: fetchMock,
    });

    await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

    const [, requestOptions] = fetchMock.mock.calls[0]!;
    expect(requestOptions.headers['anthropic-workspace-id']).toBe(
      'wrkspc_test',
    );
    expect(requestOptions.headers['x-custom']).toBe('value');
  });
});

describe('anthropicAws provider - supportedUrls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should support image/* URLs', async () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });

    const model = provider('claude-sonnet-4-6');
    const supportedUrls = await model.supportedUrls;

    expect(supportedUrls['image/*']).toBeDefined();
    expect(
      supportedUrls['image/*']![0]!.test('https://example.com/image.png'),
    ).toBe(true);
  });

  it('should support application/pdf URLs', async () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });

    const model = provider('claude-sonnet-4-6');
    const supportedUrls = await model.supportedUrls;

    expect(supportedUrls['application/pdf']).toBeDefined();
    expect(
      supportedUrls['application/pdf']![0]!.test(
        'https://arxiv.org/pdf/2401.00001',
      ),
    ).toBe(true);
  });
});

describe('anthropicAws provider - model identity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets the provider name to anthropic-aws.messages on the model', () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });

    const model = provider('claude-sonnet-4-6');
    expect(model.provider).toBe('anthropic-aws.messages');
  });

  it('throws NoSuchModelError when embeddingModel is invoked', () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });

    expect(() => provider.embeddingModel('any-model-id')).toThrow(
      /no such embeddingModel/i,
    );
  });

  it('throws NoSuchModelError when imageModel is invoked', () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });

    expect(() => provider.imageModel('any-model-id')).toThrow(
      /no such imageModel/i,
    );
  });

  it('exposes files() returning an AnthropicFiles instance', () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });
    const files = provider.files();
    expect(files.specificationVersion).toBe('v4');
    expect(files.provider).toBe('anthropic-aws.messages');
    expect(typeof files.uploadFile).toBe('function');
  });

  it('exposes skills() returning an AnthropicSkills instance', () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });
    const skills = provider.skills();
    expect(skills.specificationVersion).toBe('v4');
    expect(skills.provider).toBe('anthropic-aws.skills');
    expect(typeof skills.uploadSkill).toBe('function');
  });

  it('throws if the provider function is called with new', () => {
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
    });

    expect(
      () =>
        new (provider as unknown as new (m: string) => unknown)(
          'claude-sonnet-4-6',
        ),
    ).toThrow(/cannot be called with the new keyword/);
  });
});

describe('anthropicAws provider - auth precedence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers the API-key path when both apiKey and AWS SigV4 creds are present', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'should-be-ignored');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'should-be-ignored');
    const fetchMock = createFetchMock();
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'sk-aws-platform-key',
      fetch: fetchMock,
    });

    await provider('claude-sonnet-4-6').doGenerate({ prompt: TEST_PROMPT });

    const [, requestOptions] = fetchMock.mock.calls[0]!;
    expect(requestOptions.headers['x-api-key']).toBe('sk-aws-platform-key');
    expect(requestOptions.headers.authorization).toBeUndefined();
    expect(requestOptions.headers['x-amz-date']).toBeUndefined();
  });
});

describe('anthropicAws provider - streaming', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubDefaultEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards doStream through the SigV4 / api-key fetch wrapper and yields stream events', async () => {
    const sseBody = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_1","model":"claude-sonnet-4-6","role":"assistant","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      '',
      'event: content_block_stop',
      'data: {"type":"content_block_stop","index":0}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(sseBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const provider = createAnthropicAws({
      region: 'us-west-2',
      workspaceId: 'wrkspc_test',
      apiKey: 'test-api-key',
      fetch: fetchMock,
    });

    const { stream } = await provider('claude-sonnet-4-6').doStream({
      prompt: TEST_PROMPT,
    });

    const reader = stream.getReader();
    const parts: unknown[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }

    expect(parts.length).toBeGreaterThan(0);
    expect(
      parts.some(
        p =>
          typeof p === 'object' &&
          p !== null &&
          'type' in p &&
          (p as { type: string }).type === 'text-delta',
      ),
    ).toBe(true);

    // confirm the same workspace + version headers we tested for doGenerate
    // also fire for streaming requests
    const [, requestOptions] = fetchMock.mock.calls[0]!;
    expect(requestOptions.headers['anthropic-version']).toBe('2023-06-01');
    expect(requestOptions.headers['anthropic-workspace-id']).toBe(
      'wrkspc_test',
    );
    expect(requestOptions.headers['x-api-key']).toBe('test-api-key');
  });
});
