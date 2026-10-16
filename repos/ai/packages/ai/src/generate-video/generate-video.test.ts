import type {
  Experimental_VideoModelV4,
  Experimental_VideoModelV4VideoData,
  SharedV4ProviderMetadata,
} from '@ai-sdk/provider';
import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
  vitest,
} from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';
import { MockVideoModelV4 } from '../test/mock-video-model-v4';
import type { Warning } from '../types/warning';
import { experimental_generateVideo } from './generate-video';

const prompt = 'a cat walking on a beach';
const testDate = new Date(2024, 0, 1);

const mp4Base64 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=';
const webmBase64 = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2Vib';

vi.mock('../version', () => {
  return {
    VERSION: '0.0.0-test',
  };
});

const createMockResponse = (options: {
  videos: Experimental_VideoModelV4VideoData[];
  warnings?: Warning[];
  timestamp?: Date;
  modelId?: string;
  providerMetadata?: SharedV4ProviderMetadata;
  headers?: Record<string, string>;
}) => ({
  videos: options.videos,
  warnings: options.warnings ?? [],
  providerMetadata: options.providerMetadata ?? {
    testProvider: {
      videos: options.videos.map(() => null),
    },
  },
  response: {
    timestamp: options.timestamp ?? new Date(),
    modelId: options.modelId ?? 'test-model-id',
    headers: options.headers ?? {},
  },
});

describe('experimental_generateVideo', () => {
  let logWarningsSpy: ReturnType<typeof vitest.spyOn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    logWarningsSpy = vitest
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});

    global.fetch = vi.fn(async () => {
      return new Response(convertBase64ToUint8Array(mp4Base64), {
        status: 200,
        headers: { 'content-type': 'video/mp4' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    logWarningsSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it('should send args to doGenerate', async () => {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

    await experimental_generateVideo({
      model: new MockVideoModelV4({
        doGenerate: async args => {
          capturedArgs = args;
          return createMockResponse({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
          });
        },
      }),
      prompt,
      aspectRatio: '16:9',
      resolution: '1920x1080',
      duration: 5,
      fps: 30,
      seed: 12345,
      generateAudio: true,
      providerOptions: {
        'mock-provider': {
          loop: true,
        },
      },
      headers: {
        'custom-request-header': 'request-header-value',
      },
      abortSignal,
    });

    expect(capturedArgs).toStrictEqual({
      n: 1,
      prompt,
      image: undefined,
      frameImages: undefined,
      inputReferences: undefined,
      aspectRatio: '16:9',
      resolution: '1920x1080',
      duration: 5,
      fps: 30,
      seed: 12345,
      generateAudio: true,
      providerOptions: { 'mock-provider': { loop: true } },
      headers: {
        'custom-request-header': 'request-header-value',
        'user-agent': 'ai/0.0.0-test',
      },
      abortSignal,
    });
  });

  it('should return warnings', async () => {
    const result = await experimental_generateVideo({
      model: new MockVideoModelV4({
        doGenerate: async () =>
          createMockResponse({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
            warnings: [
              {
                type: 'other',
                message: 'Setting is not supported',
              },
            ],
          }),
      }),
      prompt,
    });

    expect(result.warnings).toStrictEqual([
      {
        type: 'other',
        message: 'Setting is not supported',
      },
    ]);
  });

  it('should call logWarnings with the correct warnings', async () => {
    const expectedWarnings: Warning[] = [
      {
        type: 'other',
        message: 'Setting is not supported',
      },
      {
        type: 'unsupported',
        feature: 'duration',
        details: 'Duration parameter not supported',
      },
    ];

    await experimental_generateVideo({
      model: new MockVideoModelV4({
        doGenerate: async () =>
          createMockResponse({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
            warnings: expectedWarnings,
          }),
      }),
      prompt,
    });

    expect(logWarningsSpy).toHaveBeenCalledOnce();
    expect(logWarningsSpy).toHaveBeenCalledWith({
      warnings: expectedWarnings,
      provider: 'mock-provider',
      model: 'mock-model-id',
    });
  });

  it('should not call logWarnings when no warnings are present', async () => {
    await experimental_generateVideo({
      model: new MockVideoModelV4({
        doGenerate: async () =>
          createMockResponse({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
            warnings: [],
          }),
      }),
      prompt,
    });

    expect(logWarningsSpy).not.toHaveBeenCalled();
  });

  describe('base64 video data', () => {
    it('should return generated videos with correct mime types', async () => {
      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async () =>
            createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                { type: 'base64', data: webmBase64, mediaType: 'video/webm' },
              ],
            }),
        }),
        prompt,
      });

      expect(result.videos.length).toBe(2);
      expect(result.videos[0].mediaType).toBe('video/mp4');
      expect(result.videos[1].mediaType).toBe('video/webm');
    });

    it('should return the first video', async () => {
      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async () =>
            createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                { type: 'base64', data: webmBase64, mediaType: 'video/webm' },
              ],
            }),
        }),
        prompt,
      });

      expect(result.video.mediaType).toBe('video/mp4');
    });
  });

  describe('binary video data', () => {
    it('should return generated videos', async () => {
      const binaryData = convertBase64ToUint8Array(mp4Base64);

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async () =>
            createMockResponse({
              videos: [
                { type: 'binary', data: binaryData, mediaType: 'video/mp4' },
              ],
            }),
        }),
        prompt,
      });

      expect(result.videos.length).toBe(1);
      expect(result.video.uint8Array).toStrictEqual(binaryData);
    });
  });

  describe('URL video data', () => {
    it('should fetch and return videos from URLs', async () => {
      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async () =>
            createMockResponse({
              videos: [
                {
                  type: 'url',
                  url: 'https://example.com/video.mp4',
                  mediaType: 'video/mp4',
                },
              ],
            }),
        }),
        prompt,
      });

      expect(global.fetch).toHaveBeenCalled();
      expect(result.videos.length).toBe(1);
    });

    it('should throw DownloadError when fetch fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async () => {
          return new Response(null, { status: 404, statusText: 'Not Found' });
        },
      );

      await expect(
        experimental_generateVideo({
          model: new MockVideoModelV4({
            doGenerate: async () =>
              createMockResponse({
                videos: [
                  {
                    type: 'url',
                    url: 'https://example.com/video.mp4',
                    mediaType: 'video/mp4',
                  },
                ],
              }),
          }),
          prompt,
        }),
      ).rejects.toThrow(
        'Failed to download https://example.com/video.mp4: 404 Not Found',
      );
    });

    it('should detect mediaType via signature when provider and download return application/octet-stream', async () => {
      // Mock fetch to return octet-stream content-type (simulating CDN behavior)
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async () => {
          return new Response(convertBase64ToUint8Array(mp4Base64), {
            status: 200,
            headers: { 'content-type': 'application/octet-stream' },
          });
        },
      );

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async () =>
            createMockResponse({
              videos: [
                {
                  type: 'url',
                  url: 'https://example.com/video',
                  // Provider also returns octet-stream (or could be empty)
                  mediaType: 'application/octet-stream',
                },
              ],
            }),
        }),
        prompt,
      });

      // Should detect MP4 from file signature, not use octet-stream
      expect(result.video.mediaType).toBe('video/mp4');
    });
  });

  describe('when several calls are required', () => {
    it('should generate videos', async () => {
      let callCount = 0;

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          maxVideosPerCall: 2,
          doGenerate: async options => {
            switch (callCount++) {
              case 0:
                expect(options.n).toBe(2);
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                });
              case 1:
                expect(options.n).toBe(1);
                return createMockResponse({
                  videos: [
                    {
                      type: 'base64',
                      data: webmBase64,
                      mediaType: 'video/webm',
                    },
                  ],
                });
              default:
                throw new Error('Unexpected call');
            }
          },
        }),
        prompt,
        n: 3,
      });

      expect(result.videos.length).toBe(3);
    });

    it('should aggregate warnings', async () => {
      const warning1: Warning = {
        type: 'other',
        message: 'Warning from call 1',
      };
      const warning2: Warning = {
        type: 'other',
        message: 'Warning from call 2',
      };

      let callCount = 0;

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          maxVideosPerCall: 1,
          doGenerate: async () => {
            switch (callCount++) {
              case 0:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  warnings: [warning1],
                });
              case 1:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  warnings: [warning2],
                });
              default:
                throw new Error('Unexpected call');
            }
          },
        }),
        prompt,
        n: 2,
      });

      expect(result.warnings).toStrictEqual([warning1, warning2]);
    });

    test.each([
      ['sync method', () => 2],
      ['async method', async () => 2],
    ])(
      'should generate with maxVideosPerCall = %s',
      async (_, maxVideosPerCall) => {
        let callCount = 0;
        const maxVideosPerCallMock = vitest.fn(maxVideosPerCall);

        const result = await experimental_generateVideo({
          model: new MockVideoModelV4({
            maxVideosPerCall: maxVideosPerCallMock,
            doGenerate: async options => {
              switch (callCount++) {
                case 0:
                  expect(options.n).toBe(2);
                  return createMockResponse({
                    videos: [
                      {
                        type: 'base64',
                        data: mp4Base64,
                        mediaType: 'video/mp4',
                      },
                      {
                        type: 'base64',
                        data: mp4Base64,
                        mediaType: 'video/mp4',
                      },
                    ],
                  });
                case 1:
                  expect(options.n).toBe(1);
                  return createMockResponse({
                    videos: [
                      {
                        type: 'base64',
                        data: webmBase64,
                        mediaType: 'video/webm',
                      },
                    ],
                  });
                default:
                  throw new Error('Unexpected call');
              }
            },
          }),
          prompt,
          n: 3,
        });

        expect(result.videos.length).toBe(3);
        expect(maxVideosPerCallMock).toHaveBeenCalledTimes(1);
        expect(maxVideosPerCallMock).toHaveBeenCalledWith({
          modelId: 'mock-model-id',
        });
      },
    );
  });

  describe('error handling', () => {
    it('should throw NoVideoGeneratedError when no videos are returned', async () => {
      await expect(
        experimental_generateVideo({
          model: new MockVideoModelV4({
            doGenerate: async () =>
              createMockResponse({
                videos: [],
                timestamp: testDate,
              }),
          }),
          prompt,
        }),
      ).rejects.toMatchObject({
        name: 'AI_NoVideoGeneratedError',
        message: 'No video generated.',
        responses: [
          {
            timestamp: testDate,
            modelId: expect.any(String),
          },
        ],
      });
    });

    it('should include response headers in error when no videos generated', async () => {
      await expect(
        experimental_generateVideo({
          model: new MockVideoModelV4({
            doGenerate: async () =>
              createMockResponse({
                videos: [],
                timestamp: testDate,
                headers: {
                  'custom-response-header': 'response-header-value',
                },
              }),
          }),
          prompt,
        }),
      ).rejects.toMatchObject({
        name: 'AI_NoVideoGeneratedError',
        message: 'No video generated.',
        responses: [
          {
            timestamp: testDate,
            modelId: expect.any(String),
            headers: {
              'custom-response-header': 'response-header-value',
            },
          },
        ],
      });
    });
  });

  it('should return response metadata', async () => {
    const testHeaders = { 'x-test': 'value' };

    const result = await experimental_generateVideo({
      model: new MockVideoModelV4({
        doGenerate: async () =>
          createMockResponse({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
            timestamp: testDate,
            modelId: 'test-model',
            headers: testHeaders,
          }),
      }),
      prompt,
    });

    expect(result.responses).toStrictEqual([
      {
        timestamp: testDate,
        modelId: 'test-model',
        headers: testHeaders,
        providerMetadata: {
          testProvider: {
            videos: [null],
          },
        },
      },
    ]);
  });

  it('should return provider metadata', async () => {
    const result = await experimental_generateVideo({
      model: new MockVideoModelV4({
        doGenerate: async () =>
          createMockResponse({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
            timestamp: testDate,
            modelId: 'test-model',
            providerMetadata: {
              testProvider: {
                videos: [{ seed: 12345, duration: 5 }],
              },
            },
            headers: {},
          }),
      }),
      prompt,
    });

    expect(result.providerMetadata).toStrictEqual({
      testProvider: {
        videos: [{ seed: 12345, duration: 5 }],
      },
    });
  });

  describe('provider metadata merging', () => {
    it('should merge provider metadata from multiple calls', async () => {
      let callCount = 0;

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          maxVideosPerCall: 1,
          doGenerate: async () => {
            switch (callCount++) {
              case 0:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  providerMetadata: {
                    testProvider: {
                      videos: [{ seed: 111 }],
                    },
                  },
                });
              case 1:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  providerMetadata: {
                    testProvider: {
                      videos: [{ seed: 222 }],
                    },
                  },
                });
              default:
                throw new Error('Unexpected call');
            }
          },
        }),
        prompt,
        n: 2,
      });

      expect(result.providerMetadata).toStrictEqual({
        testProvider: {
          videos: [{ seed: 111 }, { seed: 222 }],
        },
      });
    });

    it('should handle gateway provider metadata', async () => {
      let callCount = 0;

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          maxVideosPerCall: 1,
          doGenerate: async () => {
            switch (callCount++) {
              case 0:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  providerMetadata: {
                    gateway: {
                      videos: [{ seed: 111 }],
                      routing: { provider: 'fal' },
                    },
                  },
                });
              case 1:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  providerMetadata: {
                    gateway: {
                      videos: [{ seed: 222 }],
                      cost: '0.08',
                    },
                  },
                });
              default:
                throw new Error('Unexpected call');
            }
          },
        }),
        prompt,
        n: 2,
      });

      // Gateway metadata is merged like any other provider
      expect(result.providerMetadata.gateway).toStrictEqual({
        videos: [{ seed: 111 }, { seed: 222 }],
        routing: { provider: 'fal' },
        cost: '0.08',
      });
    });

    it('should handle undefined providerMetadata', async () => {
      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async () => ({
            videos: [
              { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
            ],
            warnings: [],
            providerMetadata: undefined,
            response: {
              timestamp: new Date(),
              modelId: 'test-model-id',
              headers: {},
            },
          }),
        }),
        prompt,
      });

      expect(result.providerMetadata).toStrictEqual({});
    });

    it('should preserve per-call providerMetadata in responses array', async () => {
      let callCount = 0;

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          maxVideosPerCall: 1,
          doGenerate: async () => {
            switch (callCount++) {
              case 0:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  providerMetadata: {
                    testProvider: {
                      videos: [{ seed: 111, duration: 5 }],
                      requestId: 'req-001',
                    },
                  },
                });
              case 1:
                return createMockResponse({
                  videos: [
                    { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
                  ],
                  providerMetadata: {
                    testProvider: {
                      videos: [{ seed: 222, duration: 8 }],
                      requestId: 'req-002',
                    },
                  },
                });
              default:
                throw new Error('Unexpected call');
            }
          },
        }),
        prompt,
        n: 2,
      });

      // Verify per-call metadata is preserved in responses array
      expect(result.responses).toHaveLength(2);
      expect(result.responses[0].providerMetadata).toStrictEqual({
        testProvider: {
          videos: [{ seed: 111, duration: 5 }],
          requestId: 'req-001',
        },
      });
      expect(result.responses[1].providerMetadata).toStrictEqual({
        testProvider: {
          videos: [{ seed: 222, duration: 8 }],
          requestId: 'req-002',
        },
      });

      // Top-level merged metadata still works
      expect(result.providerMetadata).toStrictEqual({
        testProvider: {
          videos: [
            { seed: 111, duration: 5 },
            { seed: 222, duration: 8 },
          ],
          requestId: 'req-002', // Last call wins for non-array fields
        },
      });
    });
  });

  describe('prompt normalization', () => {
    it('should handle string prompt', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a simple text prompt',
      });

      expect(capturedArgs.prompt).toBe('a simple text prompt');
      expect(capturedArgs.image).toBeUndefined();
    });

    it('should handle object prompt with text and image', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];
      const imageBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          text: 'image to video prompt',
          image: imageBase64,
        },
      });

      expect(capturedArgs.prompt).toBe('image to video prompt');
      expect(capturedArgs.image).toBeDefined();
    });

    it('should handle URL image in prompt', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          image: 'https://example.com/image.png',
        },
      });

      expect(capturedArgs.image).toStrictEqual({
        type: 'url',
        url: 'https://example.com/image.png',
      });
    });

    it('should handle data URL image in prompt', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
      const dataUrl = `data:image/png;base64,${pngBase64}`;

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          image: dataUrl,
        },
      });

      expect(capturedArgs.image).toStrictEqual({
        type: 'file',
        data: convertBase64ToUint8Array(pngBase64),
        mediaType: 'image/png',
      });
    });

    it('should handle Uint8Array image in prompt', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
      const uint8Array = convertBase64ToUint8Array(pngBase64);

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          image: uint8Array,
        },
      });

      expect(capturedArgs.image).toBeDefined();
      expect(capturedArgs.image?.type).toBe('file');
    });

    it('should detect image mediaType from raw base64 string via signature detection', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];
      // Raw base64 PNG (not a data URL) - must be detected via signature
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          image: pngBase64,
        },
      });

      expect(capturedArgs.image).toStrictEqual({
        type: 'file',
        data: convertBase64ToUint8Array(pngBase64),
        mediaType: 'image/png',
      });
    });

    it('should detect image mediaType from Uint8Array via signature detection', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];
      // JPEG magic bytes: 0xFF 0xD8 0xFF
      const jpegBytes = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          image: jpegBytes,
        },
      });

      expect(capturedArgs.image).toBeDefined();
      expect(capturedArgs.image?.type).toBe('file');
      if (capturedArgs.image?.type === 'file') {
        expect(capturedArgs.image.mediaType).toBe('image/jpeg');
      }
    });
  });

  describe('frameImages', () => {
    it('should normalize and pass frameImages through to the model', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        frameImages: [
          {
            image: 'https://example.com/first.png',
            frameType: 'first_frame',
          },
          {
            image: 'https://example.com/last.png',
            frameType: 'last_frame',
          },
        ],
      });

      expect(capturedArgs.frameImages).toStrictEqual([
        {
          image: { type: 'url', url: 'https://example.com/first.png' },
          frameType: 'first_frame',
        },
        {
          image: { type: 'url', url: 'https://example.com/last.png' },
          frameType: 'last_frame',
        },
      ]);
    });

    it('should copy a first_frame entry into the image field when no image is provided', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        frameImages: [
          {
            image: 'https://example.com/first.png',
            frameType: 'first_frame',
          },
        ],
      });

      expect(capturedArgs.image).toStrictEqual({
        type: 'url',
        url: 'https://example.com/first.png',
      });
      expect(capturedArgs.frameImages).toStrictEqual([
        {
          image: { type: 'url', url: 'https://example.com/first.png' },
          frameType: 'first_frame',
        },
      ]);
    });

    it('should prefer the first_frame over prompt.image and warn when both are provided', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          text: 'a clip',
          image: 'https://example.com/prompt-image.png',
        },
        frameImages: [
          {
            image: 'https://example.com/frame-first.png',
            frameType: 'first_frame',
          },
        ],
      });

      expect(capturedArgs.image).toStrictEqual({
        type: 'url',
        url: 'https://example.com/frame-first.png',
      });
      expect(capturedArgs.frameImages).toStrictEqual([
        {
          image: { type: 'url', url: 'https://example.com/frame-first.png' },
          frameType: 'first_frame',
        },
      ]);
      expect(result.warnings).toContainEqual({
        type: 'other',
        message:
          'prompt.image was ignored because a first_frame frameImage was provided; ' +
          'the first_frame frameImage takes precedence as the start image.',
      });
    });

    it('should pass only last_frame in frameImages without setting image', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        frameImages: [
          {
            image: 'https://example.com/last.png',
            frameType: 'last_frame',
          },
        ],
      });

      expect(capturedArgs.image).toBeUndefined();
      expect(capturedArgs.frameImages).toStrictEqual([
        {
          image: { type: 'url', url: 'https://example.com/last.png' },
          frameType: 'last_frame',
        },
      ]);
    });

    it('should keep the prompt image when frameImages only has a last_frame and prompt image is provided', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: {
          text: 'a clip',
          image: 'https://example.com/prompt-image.png',
        },
        frameImages: [
          {
            image: 'https://example.com/last.png',
            frameType: 'last_frame',
          },
        ],
      });

      expect(capturedArgs.image).toStrictEqual({
        type: 'url',
        url: 'https://example.com/prompt-image.png',
      });
      expect(capturedArgs.frameImages).toStrictEqual([
        {
          image: { type: 'url', url: 'https://example.com/last.png' },
          frameType: 'last_frame',
        },
      ]);
    });
  });

  describe('inputReferences', () => {
    it('should normalize and pass inputReferences through to the model', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        inputReferences: [
          'https://example.com/ref-1.png',
          'https://example.com/ref-2.png',
        ],
      });

      expect(capturedArgs.inputReferences).toStrictEqual([
        { type: 'url', url: 'https://example.com/ref-1.png' },
        { type: 'url', url: 'https://example.com/ref-2.png' },
      ]);
    });

    it('should detect video media type from binary inputReferences without object form', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];
      const mp4Bytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      ]);

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        inputReferences: [mp4Bytes],
      });

      expect(capturedArgs.inputReferences).toStrictEqual([
        {
          type: 'file',
          mediaType: 'video/mp4',
          data: mp4Bytes,
        },
      ]);
    });

    it('should carry mediaType from the object form for URL references', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        inputReferences: [
          {
            data: 'https://example.com/role.mp4',
            mediaType: 'video/mp4',
          },
          'https://example.com/plain.png',
        ],
      });

      expect(capturedArgs.inputReferences).toStrictEqual([
        {
          type: 'url',
          url: 'https://example.com/role.mp4',
          mediaType: 'video/mp4',
        },
        { type: 'url', url: 'https://example.com/plain.png' },
      ]);
    });

    it('should pass inputReferences as undefined when not provided', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
      });

      expect(capturedArgs.inputReferences).toBeUndefined();
    });

    it('should ignore inputReferences when frameImages is provided', async () => {
      let capturedArgs!: Parameters<Experimental_VideoModelV4['doGenerate']>[0];

      const result = await experimental_generateVideo({
        model: new MockVideoModelV4({
          doGenerate: async args => {
            capturedArgs = args;
            return createMockResponse({
              videos: [
                { type: 'base64', data: mp4Base64, mediaType: 'video/mp4' },
              ],
            });
          },
        }),
        prompt: 'a clip',
        frameImages: [
          {
            image: 'https://example.com/first.png',
            frameType: 'first_frame',
          },
        ],
        inputReferences: [
          'https://example.com/ref-1.png',
          'https://example.com/ref-2.png',
        ],
      });

      expect(capturedArgs.frameImages).toStrictEqual([
        {
          image: { type: 'url', url: 'https://example.com/first.png' },
          frameType: 'first_frame',
        },
      ]);
      expect(capturedArgs.inputReferences).toBeUndefined();
      expect(result.warnings).toContainEqual({
        type: 'other',
        message:
          'inputReferences were ignored because frameImages were provided; ' +
          'frameImages and inputReferences cannot be combined.',
      });
    });
  });
});
