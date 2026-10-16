import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { AmazonBedrockEmbeddingModel } from './amazon-bedrock-embedding-model';
import { injectFetchHeaders } from './inject-fetch-headers';
import { beforeEach, describe, expect, it } from 'vitest';

const mockEmbeddings = [
  [-0.09, 0.05, -0.02, 0.01, 0.04],
  [-0.08, 0.06, -0.03, 0.02, 0.03],
];

const fakeFetchWithAuth = injectFetchHeaders({ 'x-amz-auth': 'test-auth' });

const testValues = ['sunny day at the beach', 'rainy day in the city'];

const embedUrl = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(
  'amazon.titan-embed-text-v2:0',
)}/invoke`;

const cohereEmbedUrl = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(
  'cohere.embed-english-v3',
)}/invoke`;

const cohereV4EmbedUrl = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(
  'cohere.embed-v4:0',
)}/invoke`;

const cohereV4UsProfileEmbedUrl = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(
  'us.cohere.embed-v4:0',
)}/invoke`;

describe('doEmbed', () => {
  const mockConfigHeaders = {
    'config-header': 'config-value',
    'shared-header': 'config-shared',
  };

  const server = createTestServer({
    [embedUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
        },
        body: Buffer.from(
          JSON.stringify({
            embedding: mockEmbeddings[0],
            inputTextTokenCount: 8,
          }),
        ),
      },
    },
    [cohereEmbedUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
          'x-amzn-bedrock-input-token-count': '6',
        },
        body: Buffer.from(
          JSON.stringify({
            embeddings: [mockEmbeddings[0]],
          }),
        ),
      },
    },
    [cohereV4EmbedUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
          'x-amzn-bedrock-input-token-count': '6',
        },
        body: Buffer.from(
          JSON.stringify({
            embeddings: { float: [mockEmbeddings[0]] },
          }),
        ),
      },
    },
    [cohereV4UsProfileEmbedUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
          'x-amzn-bedrock-input-token-count': '6',
        },
        body: Buffer.from(
          JSON.stringify({
            embeddings: { float: [mockEmbeddings[0]] },
          }),
        ),
      },
    },
  });

  const model = new AmazonBedrockEmbeddingModel(
    'amazon.titan-embed-text-v2:0',
    {
      baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
      headers: mockConfigHeaders,
      fetch: fakeFetchWithAuth,
    },
  );

  it('should expose model-specific max embeddings per call', () => {
    const cohereModel = new AmazonBedrockEmbeddingModel(
      'cohere.embed-english-v3',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: mockConfigHeaders,
        fetch: fakeFetchWithAuth,
      },
    );
    const cohereV4UsProfileModel = new AmazonBedrockEmbeddingModel(
      'us.cohere.embed-v4:0',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: mockConfigHeaders,
        fetch: fakeFetchWithAuth,
      },
    );
    const novaModel = new AmazonBedrockEmbeddingModel(
      'amazon.nova-2-multimodal-embeddings-v1:0',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: mockConfigHeaders,
        fetch: fakeFetchWithAuth,
      },
    );

    expect(model.maxEmbeddingsPerCall).toBe(1);
    expect(cohereModel.maxEmbeddingsPerCall).toBe(96);
    expect(cohereV4UsProfileModel.maxEmbeddingsPerCall).toBe(96);
    expect(novaModel.maxEmbeddingsPerCall).toBe(1);
  });

  let callCount = 0;

  beforeEach(() => {
    callCount = 0;
    server.urls[embedUrl].response = {
      type: 'binary',
      headers: {
        'content-type': 'application/json',
      },
      body: Buffer.from(
        JSON.stringify({
          embedding: mockEmbeddings[0],
          inputTextTokenCount: 8,
        }),
      ),
    };
  });

  it('should handle single input value and return embeddings', async () => {
    const { embeddings } = await model.doEmbed({
      values: [testValues[0]],
    });

    expect(embeddings.length).toBe(1);
    expect(embeddings[0]).toMatchInlineSnapshot(`
      [
        -0.09,
        0.05,
        -0.02,
        0.01,
        0.04,
      ]
    `);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      inputText: testValues[0],
      dimensions: undefined,
      normalize: undefined,
    });
  });

  it('should handle single input value and extract usage', async () => {
    const { usage } = await model.doEmbed({
      values: [testValues[0]],
    });

    expect(usage?.tokens).toMatchInlineSnapshot(`8`);
  });

  it('should support Cohere embedding models', async () => {
    const cohereModel = new AmazonBedrockEmbeddingModel(
      'cohere.embed-english-v3',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: mockConfigHeaders,
        fetch: fakeFetchWithAuth,
      },
    );

    const { embeddings, usage } = await cohereModel.doEmbed({
      values: [testValues[0]],
    });

    expect(embeddings.length).toBe(1);
    expect(embeddings[0]).toMatchInlineSnapshot(`
      [
        -0.09,
        0.05,
        -0.02,
        0.01,
        0.04,
      ]
    `);
    expect(usage?.tokens).toBe(6);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      input_type: 'search_query',
      texts: [testValues[0]],
      truncate: undefined,
      output_dimension: undefined,
    });
  });

  it('should support Cohere v4 embedding models', async () => {
    const cohereV4Model = new AmazonBedrockEmbeddingModel('cohere.embed-v4:0', {
      baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
      headers: mockConfigHeaders,
      fetch: fakeFetchWithAuth,
    });

    const { embeddings, usage } = await cohereV4Model.doEmbed({
      values: [testValues[0]],
    });

    expect(embeddings.length).toBe(1);
    expect(embeddings[0]).toMatchInlineSnapshot(`
      [
        -0.09,
        0.05,
        -0.02,
        0.01,
        0.04,
      ]
    `);
    expect(usage?.tokens).toBe(6);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      input_type: 'search_query',
      texts: [testValues[0]],
      truncate: undefined,
      output_dimension: undefined,
    });
  });

  it('should send multiple values for Cohere embedding models', async () => {
    server.urls[cohereV4EmbedUrl].response = {
      type: 'binary',
      headers: {
        'content-type': 'application/json',
        'x-amzn-bedrock-input-token-count': '12',
      },
      body: Buffer.from(
        JSON.stringify({
          embeddings: { float: mockEmbeddings },
        }),
      ),
    };

    const cohereV4Model = new AmazonBedrockEmbeddingModel('cohere.embed-v4:0', {
      baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
      headers: mockConfigHeaders,
      fetch: fakeFetchWithAuth,
    });

    const { embeddings, usage } = await cohereV4Model.doEmbed({
      values: testValues,
    });

    expect(embeddings).toStrictEqual(mockEmbeddings);
    expect(usage?.tokens).toBe(12);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      input_type: 'search_query',
      texts: testValues,
      truncate: undefined,
      output_dimension: undefined,
    });
  });

  it('should return NaN usage for Cohere models when the token count header is absent', async () => {
    server.urls[cohereV4EmbedUrl].response = {
      type: 'binary',
      headers: {
        'content-type': 'application/json',
      },
      body: Buffer.from(
        JSON.stringify({
          embeddings: { float: [mockEmbeddings[0]] },
        }),
      ),
    };

    const cohereV4Model = new AmazonBedrockEmbeddingModel('cohere.embed-v4:0', {
      baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
      headers: mockConfigHeaders,
      fetch: fakeFetchWithAuth,
    });

    const { usage } = await cohereV4Model.doEmbed({
      values: [testValues[0]],
    });

    expect(Number.isNaN(usage?.tokens)).toBe(true);
  });

  it('should support Cohere models behind cross-region inference profile ids', async () => {
    const cohereV4UsProfileModel = new AmazonBedrockEmbeddingModel(
      'us.cohere.embed-v4:0',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: mockConfigHeaders,
        fetch: fakeFetchWithAuth,
      },
    );

    const { embeddings, usage } = await cohereV4UsProfileModel.doEmbed({
      values: [testValues[0]],
    });

    expect(embeddings.length).toBe(1);
    expect(usage?.tokens).toBe(6);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      input_type: 'search_query',
      texts: [testValues[0]],
      truncate: undefined,
      output_dimension: undefined,
    });
  });

  it('should pass outputDimension for Cohere v4 embedding models', async () => {
    const cohereV4Model = new AmazonBedrockEmbeddingModel('cohere.embed-v4:0', {
      baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
      headers: mockConfigHeaders,
      fetch: fakeFetchWithAuth,
    });

    const { embeddings } = await cohereV4Model.doEmbed({
      values: [testValues[0]],
      providerOptions: {
        bedrock: {
          outputDimension: 256,
        },
      },
    });

    expect(embeddings.length).toBe(1);
    expect(embeddings[0]).toMatchInlineSnapshot(`
      [
        -0.09,
        0.05,
        -0.02,
        0.01,
        0.04,
      ]
    `);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      input_type: 'search_query',
      texts: [testValues[0]],
      truncate: undefined,
      output_dimension: 256,
    });
  });

  it('should properly combine headers from all sources', async () => {
    const optionsHeaders = {
      'options-header': 'options-value',
      'shared-header': 'options-shared',
    };

    const modelWithHeaders = new AmazonBedrockEmbeddingModel(
      'amazon.titan-embed-text-v2:0',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: {
          'model-header': 'model-value',
          'shared-header': 'model-shared',
        },
        fetch: injectFetchHeaders({
          'signed-header': 'signed-value',
          authorization: 'AWS4-HMAC-SHA256...',
        }),
      },
    );

    await modelWithHeaders.doEmbed({
      values: [testValues[0]],
      headers: optionsHeaders,
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['options-header']).toBe('options-value');
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
    expect(requestHeaders['shared-header']).toBe('options-shared');
  });

  it('should work with partial headers', async () => {
    const modelWithPartialHeaders = new AmazonBedrockEmbeddingModel(
      'amazon.titan-embed-text-v2:0',
      {
        baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
        headers: {
          'model-header': 'model-value',
        },
        fetch: injectFetchHeaders({
          'signed-header': 'signed-value',
          authorization: 'AWS4-HMAC-SHA256...',
        }),
      },
    );

    await modelWithPartialHeaders.doEmbed({
      values: [testValues[0]],
    });

    const requestHeaders = server.calls[0].requestHeaders;
    expect(requestHeaders['model-header']).toBe('model-value');
    expect(requestHeaders['signed-header']).toBe('signed-value');
    expect(requestHeaders['authorization']).toBe('AWS4-HMAC-SHA256...');
  });
});

describe('should support Nova embeddings', () => {
  const novaModelId = 'amazon.nova-2-multimodal-embeddings-v1:0';
  const novaEmbedUrl = `https://bedrock-runtime.us-east-1.amazonaws.com/model/${encodeURIComponent(
    novaModelId,
  )}/invoke`;

  const server = createTestServer({
    [novaEmbedUrl]: {
      response: {
        type: 'binary',
        headers: {
          'content-type': 'application/json',
        },
        body: Buffer.from(
          JSON.stringify({
            embeddings: [
              {
                embeddingType: 'TEXT',
                embedding: mockEmbeddings[0],
              },
            ],
            inputTokenCount: 8,
          }),
        ),
      },
    },
  });

  const model = new AmazonBedrockEmbeddingModel(novaModelId, {
    baseUrl: () => 'https://bedrock-runtime.us-east-1.amazonaws.com',
    headers: {
      'config-header': 'config-value',
    },
    fetch: fakeFetchWithAuth,
  });

  it('should send SINGLE_EMBEDDING payload for Nova embeddings', async () => {
    const { embeddings } = await model.doEmbed({
      values: [testValues[0]],
    });

    expect(embeddings[0]).toMatchInlineSnapshot(`
      [
        -0.09,
        0.05,
        -0.02,
        0.01,
        0.04,
      ]
    `);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      taskType: 'SINGLE_EMBEDDING',
      singleEmbeddingParams: {
        embeddingPurpose: 'GENERIC_INDEX',
        embeddingDimension: 1024,
        text: {
          truncationMode: 'END',
          value: testValues[0],
        },
      },
    });
  });

  it('should pass embeddingDimension for Nova embeddings', async () => {
    const { embeddings } = await model.doEmbed({
      values: [testValues[0]],
      providerOptions: {
        bedrock: {
          embeddingDimension: 256,
        },
      },
    });

    expect(embeddings[0]).toMatchInlineSnapshot(`
      [
        -0.09,
        0.05,
        -0.02,
        0.01,
        0.04,
      ]
    `);

    const body = await server.calls[0].requestBodyJson;
    expect(body).toEqual({
      taskType: 'SINGLE_EMBEDDING',
      singleEmbeddingParams: {
        embeddingPurpose: 'GENERIC_INDEX',
        embeddingDimension: 256,
        text: {
          truncationMode: 'END',
          value: testValues[0],
        },
      },
    });
  });
});
