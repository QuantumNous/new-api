import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { createProdia } from './prodia-provider';

function createMultipartResponse(
  jobResult: Record<string, unknown>,
  imageContent: string = 'test-image',
): { body: Buffer; contentType: string } {
  const boundary = 'test-boundary-12345';
  const jobJson = JSON.stringify(jobResult);
  const imageBuffer = Buffer.from(imageContent);

  const parts = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="job"; filename="job.json"\r\n',
    'Content-Type: application/json\r\n',
    '\r\n',
    jobJson,
    '\r\n',
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="output"; filename="output.png"\r\n',
    'Content-Type: image/png\r\n',
    '\r\n',
  ];

  const headerPart = Buffer.from(parts.join(''));
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat([headerPart, imageBuffer, endPart]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const defaultJobResult = {
  id: 'job-123',
  state: { current: 'completed' },
  config: { prompt: 'test' },
};

const multipartResponse = createMultipartResponse(defaultJobResult);

const server = createTestServer({
  'https://api.example.com/v2/job?price=true': {
    response: {
      type: 'binary',
      body: multipartResponse.body,
      headers: {
        'content-type': multipartResponse.contentType,
      },
    },
  },
});

describe('Prodia provider', () => {
  it('creates image models via .image and .imageModel', () => {
    const provider = createProdia();

    const imageModel = provider.image('inference.flux-fast.schnell.txt2img.v2');
    const imageModel2 = provider.imageModel(
      'inference.flux.schnell.txt2img.v2',
    );

    expect(imageModel.provider).toBe('prodia.image');
    expect(imageModel.modelId).toBe('inference.flux-fast.schnell.txt2img.v2');
    expect(imageModel2.modelId).toBe('inference.flux.schnell.txt2img.v2');
    expect(imageModel.specificationVersion).toBe('v4');
  });

  it('creates language models via .languageModel', () => {
    const provider = createProdia();

    const model = provider.languageModel('inference.nano-banana.img2img.v2');

    expect(model.provider).toBe('prodia.language');
    expect(model.modelId).toBe('inference.nano-banana.img2img.v2');
    expect(model.specificationVersion).toBe('v4');
  });

  it('creates video models via .video and .videoModel', () => {
    const provider = createProdia();

    const videoModel = provider.video('inference.wan2-2.lightning.txt2vid.v0');
    const videoModel2 = provider.videoModel(
      'inference.wan2-2.lightning.img2vid.v0',
    );

    expect(videoModel.provider).toBe('prodia.video');
    expect(videoModel.modelId).toBe('inference.wan2-2.lightning.txt2vid.v0');
    expect(videoModel2.modelId).toBe('inference.wan2-2.lightning.img2vid.v0');
    expect(videoModel.specificationVersion).toBe('v4');
  });

  it('configures baseURL and headers correctly', async () => {
    const provider = createProdia({
      apiKey: 'test-api-key',
      baseURL: 'https://api.example.com/v2',
      headers: {
        'x-extra-header': 'extra',
      },
    });

    const model = provider.image('inference.flux-fast.schnell.txt2img.v2');

    await model.doGenerate({
      prompt: 'A serene mountain landscape at sunset',
      files: undefined,
      mask: undefined,
      n: 1,
      size: undefined,
      seed: undefined,
      aspectRatio: undefined,
      providerOptions: {},
    });

    expect(server.calls[0].requestUrl).toBe(
      'https://api.example.com/v2/job?price=true',
    );
    expect(server.calls[0].requestMethod).toBe('POST');
    expect(server.calls[0].requestHeaders.authorization).toBe(
      'Bearer test-api-key',
    );
    expect(server.calls[0].requestHeaders['x-extra-header']).toBe('extra');
    expect(server.calls[0].requestHeaders.accept).toBe(
      'multipart/form-data; image/png',
    );
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      type: 'inference.flux-fast.schnell.txt2img.v2',
      config: {
        prompt: 'A serene mountain landscape at sunset',
      },
    });

    expect(server.calls[0].requestUserAgent).toContain('ai-sdk/prodia/');
  });

  it('throws NoSuchModelError for unsupported model types', () => {
    const provider = createProdia();

    expect(() => provider.embeddingModel('some-id')).toThrowError(
      'No such embeddingModel',
    );
  });
});
