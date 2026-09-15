import type { GoogleProviderMetadata } from '@ai-sdk/google';
import type {
  EmbeddingModelV3,
  EmbeddingModelV4,
  ImageModelV3,
  ImageModelV4,
  LanguageModelV3,
  LanguageModelV4,
} from '@ai-sdk/provider';
import {
  APICallError,
  embed,
  embedMany,
  generateImage,
  generateText,
  Output,
  isStepCount,
  streamText,
} from 'ai';
import fs from 'fs';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

export type Capability =
  | 'audioInput'
  | 'embedding'
  | 'imageGeneration'
  | 'imageInput'
  | 'objectGeneration'
  | 'pdfInput'
  | 'searchGrounding'
  | 'textCompletion'
  | 'toolCalls';

export type ModelCapabilities = Capability[];

export interface ModelWithCapabilities<T> {
  model: T;
  capabilities?: ModelCapabilities;
}

export const defaultChatModelCapabilities: ModelCapabilities = [
  // audioInput is not supported by most language models.
  // embedding is not supported by language models.
  // imageGeneration is not supported by language models.
  'imageInput',
  'objectGeneration',
  'pdfInput',
  // searchGrounding is not supported by most language models.
  'textCompletion',
  'toolCalls',
];

export const createLanguageModelWithCapabilities = (
  model: LanguageModelV3 | LanguageModelV4,
  capabilities: ModelCapabilities = defaultChatModelCapabilities,
): ModelWithCapabilities<LanguageModelV3 | LanguageModelV4> => ({
  model,
  capabilities,
});

export const createEmbeddingModelWithCapabilities = (
  model: EmbeddingModelV3 | EmbeddingModelV4,
  capabilities: ModelCapabilities = ['embedding'],
): ModelWithCapabilities<EmbeddingModelV3 | EmbeddingModelV4> => ({
  model,
  capabilities,
});

export const createImageModelWithCapabilities = (
  model: ImageModelV3 | ImageModelV4,
  capabilities: ModelCapabilities = ['imageGeneration'],
): ModelWithCapabilities<ImageModelV3 | ImageModelV4> => ({
  model,
  capabilities,
});

export interface ModelVariants {
  invalidModel?: LanguageModelV3 | LanguageModelV4;
  languageModels?: ModelWithCapabilities<LanguageModelV3 | LanguageModelV4>[];
  embeddingModels?: ModelWithCapabilities<
    EmbeddingModelV3 | EmbeddingModelV4
  >[];
  invalidImageModel?: ImageModelV3 | ImageModelV4;
  imageModels?: ModelWithCapabilities<ImageModelV3 | ImageModelV4>[];
}

export interface TestSuiteOptions {
  name: string;
  models: ModelVariants;
  timeout?: number;
  customAssertions?: {
    skipUsage?: boolean;
    errorValidator?: (error: APICallError) => void;
  };
}

const createModelObjects = <T extends { modelId: string }>(
  models: ModelWithCapabilities<T>[] | undefined,
) =>
  models?.map(({ model, capabilities }) => ({
    modelId: model.modelId,
    model,
    capabilities,
  })) || [];

const verifyGroundingMetadata = (groundingMetadata: any) => {
  expect(Array.isArray(groundingMetadata?.webSearchQueries)).toBe(true);
  expect(groundingMetadata?.webSearchQueries?.length).toBeGreaterThan(0);

  // Verify search entry point exists
  expect(groundingMetadata?.searchEntryPoint?.renderedContent).toBeDefined();

  // Verify grounding supports
  expect(Array.isArray(groundingMetadata?.groundingSupports)).toBe(true);
  const support = groundingMetadata?.groundingSupports?.[0];
  expect(support?.segment).toBeDefined();
  expect(Array.isArray(support?.groundingChunkIndices)).toBe(true);
  expect(Array.isArray(support?.confidenceScores)).toBe(true);
};

const verifySafetyRatings = (safetyRatings: any[]) => {
  expect(Array.isArray(safetyRatings)).toBe(true);
  expect(safetyRatings?.length).toBeGreaterThan(0);

  // Verify each safety rating has required properties
  safetyRatings?.forEach(rating => {
    expect(rating.category).toBeDefined();
    expect(rating.probability).toBeDefined();
    expect(typeof rating.probabilityScore).toBe('number');
    expect(rating.severity).toBeDefined();
    expect(typeof rating.severityScore).toBe('number');
  });
};

const shouldRunTests = (
  capabilities: ModelCapabilities | undefined,
  requiredCapabilities: Capability[],
) => {
  return capabilities
    ? requiredCapabilities.every(cap => capabilities.includes(cap))
    : false;
};

function describeIfCapability(
  capabilities: ModelCapabilities | undefined,
  requiredCapabilities: Capability[],
  description: string,
  callback: () => void,
) {
  if (shouldRunTests(capabilities, requiredCapabilities)) {
    describe(description, callback);
  }
}

export function createFeatureTestSuite({
  name,
  models,
  timeout = 10000,
  customAssertions = { skipUsage: false },
}: TestSuiteOptions) {
  return () => {
    const errorValidator =
      customAssertions.errorValidator ||
      ((error: APICallError) => {
        throw new Error('errorValidator not implemented');
      });

    describe(`${name} Feature Test Suite`, () => {
      vi.setConfig({ testTimeout: timeout });

      describe.each(createModelObjects(models.languageModels))(
        'Language Model: $modelId',
        ({ model, capabilities }) => {
          describeIfCapability(
            capabilities,
            ['textCompletion'],
            'Basic Text Generation',
            () => {
              it('should generate text', async () => {
                const result = await generateText({
                  model,
                  prompt: 'Write a haiku about programming.',
                });

                expect(result.text).toBeTruthy();
                if (!customAssertions.skipUsage) {
                  expect(result.usage?.totalTokens).toBeGreaterThan(0);
                }
              });

              it('should generate text with system prompt', async () => {
                const result = await generateText({
                  model,
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a helpful assistant.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Write a haiku about programming.',
                        },
                      ],
                    },
                  ],
                });

                expect(result.text).toBeTruthy();
                expect(result.usage?.totalTokens).toBeGreaterThan(0);
              });

              it('should stream text', async () => {
                const result = streamText({
                  model,
                  prompt: 'Count from 1 to 5 slowly.',
                });

                const chunks: string[] = [];
                for await (const chunk of result.textStream) {
                  chunks.push(chunk);
                }

                expect(chunks.length).toBeGreaterThan(0);
                if (!customAssertions.skipUsage) {
                  expect((await result.usage)?.totalTokens).toBeGreaterThan(0);
                }
              });
            },
          );

          describeIfCapability(
            capabilities,
            ['objectGeneration'],
            'Object Generation',
            () => {
              it('should generate basic blog metadata', async () => {
                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      title: z.string(),
                      tags: z.array(z.string()),
                    }),
                  }),
                  prompt: 'Generate metadata for a blog post about TypeScript.',
                });

                expect(result.output?.title).toBeTruthy();
                expect(Array.isArray(result.output?.tags)).toBe(true);
                if (!customAssertions.skipUsage) {
                  expect(result.usage?.totalTokens).toBeGreaterThan(0);
                }
              });

              it('should stream RPG character list', async () => {
                const result = streamText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      characters: z.array(
                        z.object({
                          name: z.string(),
                          class: z
                            .string()
                            .describe(
                              'Character class, e.g. warrior, mage, or thief.',
                            ),
                          description: z.string(),
                        }),
                      ),
                    }),
                  }),
                  prompt: 'Generate 3 RPG character descriptions.',
                });

                const parts = [];
                for await (const part of result.partialOutputStream) {
                  parts.push(part);
                }

                expect(parts.length).toBeGreaterThan(0);
                if (!customAssertions.skipUsage) {
                  expect((await result.usage).totalTokens).toBeGreaterThan(0);
                }
              });

              it('should generate a simple object', async () => {
                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      name: z.string(),
                      age: z.number(),
                    }),
                  }),
                  prompt: 'Generate details for a person.',
                });

                expect(result.output?.name).toBeTruthy();
                expect(typeof result.output?.age).toBe('number');
                if (!customAssertions.skipUsage) {
                  expect(result.usage?.totalTokens).toBeGreaterThan(0);
                }
              });

              it('should generate multiple simple items', async () => {
                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      items: z
                        .array(
                          z.object({
                            name: z.string(),
                            quantity: z.number(),
                          }),
                        )
                        .length(3),
                    }),
                  }),
                  prompt: 'Generate a shopping list with 3 items.',
                });

                expect(result.output?.items).toHaveLength(3);
                expect(result.output?.items?.[0].name).toBeTruthy();
                expect(typeof result.output?.items?.[0].quantity).toBe(
                  'number',
                );
              });

              it('should generate nested objects', async () => {
                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      user: z.object({
                        name: z.string(),
                        contact: z.object({
                          email: z.string(),
                          phone: z.string(),
                        }),
                      }),
                      preferences: z.object({
                        theme: z.enum(['light', 'dark']),
                        notifications: z.boolean(),
                      }),
                    }),
                  }),
                  prompt:
                    'Generate a user profile with contact details and preferences.',
                });

                expect(typeof result.output?.user.name).toBe('string');
                expect(typeof result.output?.user.contact.email).toBe('string');
                expect(typeof result.output?.user.contact.phone).toBe('string');
                expect(['light', 'dark']).toContain(
                  result.output?.preferences.theme,
                );
                expect(typeof result.output?.preferences.notifications).toBe(
                  'boolean',
                );
              });

              it('should generate arrays of objects', async () => {
                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      posts: z
                        .array(
                          z.object({
                            title: z.string(),
                            comments: z
                              .array(
                                z.object({
                                  author: z.string(),
                                  text: z.string(),
                                }),
                              )
                              .min(1),
                          }),
                        )
                        .min(2),
                    }),
                  }),
                  prompt: 'Generate a blog with multiple posts and comments.',
                });

                expect(result.output!.posts.length).toBeGreaterThanOrEqual(2);
                expect(
                  result.output!.posts[0].comments.length,
                ).toBeGreaterThanOrEqual(1);
              });

              it('should handle cross-referenced schemas', async () => {
                const BaseProduct = z.object({
                  name: z.string(),
                  category: z.string(),
                  usage_instructions: z.string(),
                });

                const MorningProduct = BaseProduct.extend({
                  morning_specific_instructions: z.string(),
                });

                const EveningProduct = BaseProduct.extend({
                  evening_specific_instructions: z.string(),
                });

                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      morning_routine: z.array(MorningProduct),
                      evening_routine: z.array(EveningProduct),
                      notes: z.string(),
                    }),
                  }),
                  prompt:
                    'Generate a skincare routine with morning and evening products.',
                });

                expect(result.output!.morning_routine.length).toBeGreaterThan(
                  0,
                );
                expect(result.output!.evening_routine.length).toBeGreaterThan(
                  0,
                );
                expect(
                  result.output!.morning_routine[0]
                    .morning_specific_instructions,
                ).toBeTruthy();
                expect(
                  result.output!.evening_routine[0]
                    .evening_specific_instructions,
                ).toBeTruthy();
              });

              it('should handle equivalent flat schemas', async () => {
                const result = await generateText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      morning_routine: z.array(
                        z.object({
                          name: z.string(),
                          category: z.string(),
                          usage_instructions: z.string(),
                          morning_specific_instructions: z.string(),
                        }),
                      ),
                      evening_routine: z.array(
                        z.object({
                          name: z.string(),
                          category: z.string(),
                          usage_instructions: z.string(),
                          evening_specific_instructions: z.string(),
                        }),
                      ),
                      notes: z.string(),
                    }),
                  }),
                  prompt:
                    'Generate a skincare routine with morning and evening products.',
                });

                expect(result.output!.morning_routine.length).toBeGreaterThan(
                  0,
                );
                expect(result.output!.evening_routine.length).toBeGreaterThan(
                  0,
                );
                expect(
                  result.output!.morning_routine[0]
                    .morning_specific_instructions,
                ).toBeTruthy();
                expect(
                  result.output!.evening_routine[0]
                    .evening_specific_instructions,
                ).toBeTruthy();
              });

              it('should stream complex nested objects', async () => {
                const result = streamText({
                  model,
                  output: Output.object({
                    schema: z.object({
                      chapters: z.array(
                        z.object({
                          title: z.string(),
                          sections: z.array(
                            z.object({
                              heading: z.string(),
                              content: z.string(),
                              subsections: z.array(
                                z.object({
                                  title: z.string(),
                                  paragraphs: z.array(z.string()),
                                }),
                              ),
                            }),
                          ),
                        }),
                      ),
                    }),
                  }),
                  prompt:
                    'Generate a book outline with chapters, sections, and subsections.',
                });

                const parts = [];
                for await (const part of result.partialOutputStream) {
                  parts.push(part);
                }

                const finalResult = await result.output;
                expect(finalResult!.chapters.length).toBeGreaterThan(0);
                expect(
                  finalResult!.chapters[0].sections.length,
                ).toBeGreaterThan(0);
                expect(parts.length).toBeGreaterThan(0);
              });

              describe('Schema and Prompt Variations', () => {
                it('should generate with field descriptions', async () => {
                  const result = await generateText({
                    model,
                    output: Output.object({
                      schema: z.object({
                        title: z
                          .string()
                          .describe('A catchy title for the article'),
                        summary: z
                          .string()
                          .describe(
                            'A 2-3 sentence overview of the main points',
                          ),
                        readingTime: z
                          .number()
                          .describe('Estimated reading time in minutes'),
                        targetAudience: z
                          .array(z.string())
                          .describe('The intended reader groups'),
                      }),
                    }),
                    prompt: 'Generate metadata for a technical article.',
                  });

                  expect(result.output?.title).toBeTruthy();
                  expect(result.output!.summary.length).toBeGreaterThan(50);
                });

                it('should handle detailed system prompts', async () => {
                  const result = await generateText({
                    model,
                    output: Output.object({
                      schema: z.object({
                        recipe: z.object({
                          name: z.string(),
                          ingredients: z.array(z.string()),
                          steps: z.array(z.string()),
                        }),
                      }),
                    }),
                    messages: [
                      {
                        role: 'system',
                        content:
                          'You are a professional chef. Always provide detailed, precise cooking instructions.',
                      },
                      { role: 'user', content: 'Create a pasta recipe.' },
                    ],
                  });

                  expect(result.output!.recipe.steps.length).toBeGreaterThan(3);
                  expect(
                    result.output!.recipe.ingredients.length,
                  ).toBeGreaterThan(3);
                });

                it('should generate complex objects with both descriptions and system context', async () => {
                  const ProductSchema = z.object({
                    name: z
                      .string()
                      .describe('Product name, should be unique and memorable'),
                    price: z
                      .number()
                      .describe(
                        'Price in USD, should be competitive for market',
                      ),
                    features: z
                      .array(z.string())
                      .describe('Key selling points, 3-5 items'),
                    marketingPlan: z
                      .object({
                        targetMarket: z
                          .string()
                          .describe('Primary customer demographic'),
                        channels: z
                          .array(z.string())
                          .describe('Marketing channels to use'),
                        budget: z
                          .number()
                          .describe('Proposed marketing budget in USD'),
                      })
                      .describe('Marketing strategy details'),
                  });

                  const result = await generateText({
                    model,
                    output: Output.object({
                      schema: ProductSchema,
                      name: 'product',
                      description: 'A product listing',
                    }),
                    messages: [
                      {
                        role: 'system',
                        content:
                          'You are a senior product manager with 15 years of experience in tech products.',
                      },
                      {
                        role: 'user',
                        content:
                          'Create a product plan for a new smart home device.',
                      },
                    ],
                  });

                  expect(result.output!.features.length).toBeGreaterThanOrEqual(
                    3,
                  );
                  expect(result.output!.marketingPlan.budget).toBeGreaterThan(
                    0,
                  );
                  expect(result.output!.price).toBeGreaterThan(0);
                });
              });
            },
          );

          describeIfCapability(
            capabilities,
            ['toolCalls'],
            'Tool Calls',
            () => {
              it('should generate text with tool calls', async () => {
                const result = await generateText({
                  model,
                  prompt:
                    'What is 2+2? Use the calculator tool to compute this.',
                  tools: {
                    calculator: {
                      inputSchema: z.object({
                        expression: z
                          .string()
                          .describe('The mathematical expression to evaluate'),
                      }),
                      execute: async ({ expression }) =>
                        eval(expression).toString(),
                    },
                  },
                });

                expect(result.toolCalls?.[0]).toMatchObject({
                  toolName: 'calculator',
                  input: { expression: '2+2' },
                });
                expect(result.toolResults?.[0].output).toBe('4');
                if (!customAssertions.skipUsage) {
                  expect(result.usage?.totalTokens).toBeGreaterThan(0);
                }
              });

              it('should stream text with tool calls', async () => {
                let toolCallCount = 0;
                const result = streamText({
                  model,
                  prompt:
                    'What is 2+2? Use the calculator tool to compute this.',
                  tools: {
                    calculator: {
                      inputSchema: z.object({
                        expression: z.string(),
                      }),
                      execute: async ({ expression }) => {
                        toolCallCount++;
                        return eval(expression).toString();
                      },
                    },
                  },
                });

                const parts = [];
                for await (const part of result.stream) {
                  parts.push(part);
                }

                expect(parts.some(part => part.type === 'tool-call')).toBe(
                  true,
                );
                expect(toolCallCount).toBe(1);
                if (!customAssertions.skipUsage) {
                  expect((await result.usage).totalTokens).toBeGreaterThan(0);
                }
              });

              it('should handle multiple sequential tool calls', async () => {
                let weatherCalls = 0;
                let musicCalls = 0;
                const sfTemp = 15;
                const result = await generateText({
                  model,
                  prompt:
                    'Check the temperature in San Francisco and play music that matches the weather. Be sure to report the chosen song name.',
                  tools: {
                    getTemperature: {
                      inputSchema: z.object({
                        city: z
                          .string()
                          .describe('The city to check temperature for'),
                      }),
                      execute: async ({ city }) => {
                        weatherCalls++;
                        return `${sfTemp}`;
                      },
                    },
                    playWeatherMusic: {
                      inputSchema: z.object({
                        temperature: z
                          .number()
                          .describe('Temperature in Celsius'),
                      }),
                      execute: async ({ temperature }) => {
                        musicCalls++;
                        if (temperature <= 10) {
                          return 'Playing "Winter Winds" by Mumford & Sons';
                        } else if (temperature <= 20) {
                          return 'Playing "Foggy Day" by Frank Sinatra';
                        } else if (temperature <= 30) {
                          return 'Playing "Here Comes the Sun" by The Beatles';
                        } else {
                          return 'Playing "Hot Hot Hot" by Buster Poindexter';
                        }
                      },
                    },
                  },
                  stopWhen: isStepCount(10),
                });

                expect(weatherCalls).toBe(1);
                expect(musicCalls).toBe(1);
                expect(result.text).toContain('Foggy Day');
              });
            },
          );

          describeIfCapability(
            capabilities,
            ['imageInput'],
            'Image Input',
            () => {
              it('should generate text with image URL input', async () => {
                const result = await generateText({
                  model,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Describe the image in detail.',
                        },
                        {
                          type: 'file',
                          mediaType: 'image',
                          data: 'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
                        },
                      ],
                    },
                  ],
                });

                expect(result.text).toBeTruthy();
                expect(result.text.toLowerCase()).toContain('cat');
                if (!customAssertions.skipUsage) {
                  expect(result.usage?.totalTokens).toBeGreaterThan(0);
                }
              });

              it('should generate text with image input', async () => {
                const result = await generateText({
                  model,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Describe the image in detail.',
                        },
                        {
                          type: 'file',
                          mediaType: 'image',
                          // TODO(shaper): Some tests omit the .toString() below.
                          data: fs
                            .readFileSync('./data/comic-cat.png')
                            .toString('base64'),
                        },
                      ],
                    },
                  ],
                });

                expect(result.text.toLowerCase()).toContain('cat');
                if (!customAssertions.skipUsage) {
                  expect(result.usage?.totalTokens).toBeGreaterThan(0);
                }
              });

              it('should stream text with image URL input', async () => {
                const result = streamText({
                  model,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Describe the image in detail.',
                        },
                        {
                          type: 'file',
                          mediaType: 'image',
                          data: 'https://github.com/vercel/ai/blob/main/examples/ai-functions/data/comic-cat.png?raw=true',
                        },
                      ],
                    },
                  ],
                });

                const chunks: string[] = [];
                for await (const chunk of result.textStream) {
                  chunks.push(chunk);
                }

                const fullText = chunks.join('');
                expect(chunks.length).toBeGreaterThan(0);
                expect(fullText.toLowerCase()).toContain('cat');
                expect((await result.usage)?.totalTokens).toBeGreaterThan(0);
              });

              it('should stream text with image input', async () => {
                const result = streamText({
                  model,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Describe the image in detail.',
                        },
                        {
                          type: 'file',
                          mediaType: 'image',
                          data: fs.readFileSync('./data/comic-cat.png'),
                        },
                      ],
                    },
                  ],
                });

                const chunks: string[] = [];
                for await (const chunk of result.textStream) {
                  chunks.push(chunk);
                }

                const fullText = chunks.join('');
                expect(fullText.toLowerCase()).toContain('cat');
                expect(chunks.length).toBeGreaterThan(0);
                if (!customAssertions.skipUsage) {
                  expect((await result.usage)?.totalTokens).toBeGreaterThan(0);
                }
              });
            },
          );

          describeIfCapability(capabilities, ['pdfInput'], 'PDF Input', () => {
            it('should generate text with PDF input', async () => {
              const result = await generateText({
                model,
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Summarize the contents of this PDF.',
                      },
                      {
                        type: 'file',
                        data: fs
                          .readFileSync('./data/ai.pdf')
                          .toString('base64'),
                        mediaType: 'application/pdf',
                      },
                    ],
                  },
                ],
              });

              expect(result.text).toBeTruthy();
              expect(result.text.toLowerCase()).toContain('embedding');
              expect(result.usage?.totalTokens).toBeGreaterThan(0);
            });
          });

          describeIfCapability(
            capabilities,
            ['audioInput'],
            'Audio Input',
            () => {
              it('should generate text from audio input', async () => {
                const result = await generateText({
                  model,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Output a transcript of spoken words. Break up transcript lines when there are pauses. Include timestamps in the format of HH:MM:SS.SSS.',
                        },
                        {
                          type: 'file',
                          data: Buffer.from(
                            fs.readFileSync('./data/galileo.mp3'),
                          ),
                          mediaType: 'audio/mpeg',
                        },
                      ],
                    },
                  ],
                });
                expect(result.text).toBeTruthy();
                expect(result.text.toLowerCase()).toContain('galileo');
                expect(result.usage?.totalTokens).toBeGreaterThan(0);
              });
            },
          );

          describeIfCapability(
            capabilities,
            ['searchGrounding'],
            'Search Grounding',
            () => {
              it('should include search grounding metadata in response when search grounding is enabled', async () => {
                const result = await generateText({
                  model,
                  prompt: 'What is the current population of Tokyo?',
                });

                expect(result.text).toBeTruthy();
                expect(result.text.toLowerCase()).toContain('tokyo');
                expect(result.usage?.totalTokens).toBeGreaterThan(0);

                const metadata = result.providerMetadata?.google as
                  | GoogleProviderMetadata
                  | undefined;
                verifyGroundingMetadata(metadata?.groundingMetadata);
              });

              it('should include search grounding metadata when streaming with search grounding enabled', async () => {
                const result = streamText({
                  model,
                  prompt: 'What is the current population of Tokyo?',
                });

                const chunks: string[] = [];
                for await (const chunk of result.textStream) {
                  chunks.push(chunk);
                }

                const metadata = (await result.providerMetadata)?.google as
                  | GoogleProviderMetadata
                  | undefined;

                const completeText = chunks.join('');
                expect(completeText).toBeTruthy();
                expect(completeText.toLowerCase()).toContain('tokyo');
                expect((await result.usage)?.totalTokens).toBeGreaterThan(0);

                verifyGroundingMetadata(metadata?.groundingMetadata);
              });

              it('should include safety ratings in response when search grounding is enabled', async () => {
                const result = await generateText({
                  model,
                  prompt: 'What is the current population of Tokyo?',
                });

                const metadata = result.providerMetadata?.google as
                  | GoogleProviderMetadata
                  | undefined;
                verifySafetyRatings(metadata?.safetyRatings ?? []);
              });

              it('should include safety ratings when streaming with search grounding enabled', async () => {
                const result = streamText({
                  model,
                  prompt: 'What is the current population of Tokyo?',
                });

                for await (const _ of result.textStream) {
                  // consume the stream
                }

                const metadata = (await result.providerMetadata)?.google as
                  | GoogleProviderMetadata
                  | undefined;

                verifySafetyRatings(metadata?.safetyRatings ?? []);
              });
            },
          );
        },
      );

      if (models.invalidModel) {
        describe('Chat Model Error Handling:', () => {
          const invalidModel = models.invalidModel!;

          it('should throw error on generate text attempt with invalid model ID', async () => {
            try {
              await generateText({
                model: invalidModel,
                prompt: 'This should fail',
              });
            } catch (error) {
              expect(error).toBeInstanceOf(APICallError);
              errorValidator(error as APICallError);
            }
          });

          it('should throw error on stream text attempt with invalid model ID', async () => {
            try {
              const result = streamText({
                model: invalidModel,
                prompt: 'This should fail',
              });

              // Try to consume the stream to trigger the error
              for await (const _ of result.textStream) {
                // Do nothing with the chunks
              }

              // If we reach here, the test should fail
              expect(true).toBe(false); // Force test to fail if no error is thrown
            } catch (error) {
              expect(error).toBeInstanceOf(APICallError);
              errorValidator(error as APICallError);
            }
          });
        });
      }

      if (models.invalidImageModel) {
        describe('Image Model Error Handling:', () => {
          const invalidModel = models.invalidImageModel!;

          it('should throw error on generate image attempt with invalid model ID', async () => {
            try {
              await generateImage({
                model: invalidModel,
                prompt: 'This should fail',
              });
            } catch (error) {
              expect(error).toBeInstanceOf(APICallError);
              errorValidator(error as APICallError);
            }
          });
        });
      }

      if (models.embeddingModels && models.embeddingModels.length > 0) {
        describe.each(createModelObjects(models.embeddingModels))(
          'Embedding Model: $modelId',
          ({ model, capabilities }) => {
            describeIfCapability(
              capabilities,
              ['embedding'],
              'Embedding Generation',
              () => {
                it('should generate single embedding', async () => {
                  const result = await embed({
                    model,
                    value: 'This is a test sentence for embedding.',
                  });

                  expect(Array.isArray(result.embedding)).toBe(true);
                  expect(result.embedding.length).toBeGreaterThan(0);
                  if (!customAssertions.skipUsage) {
                    expect(result.usage?.tokens).toBeGreaterThan(0);
                  }
                });

                it('should generate multiple embeddings', async () => {
                  const result = await embedMany({
                    model,
                    values: [
                      'First test sentence.',
                      'Second test sentence.',
                      'Third test sentence.',
                    ],
                  });

                  expect(Array.isArray(result.embeddings)).toBe(true);
                  expect(result.embeddings.length).toBe(3);
                  if (!customAssertions.skipUsage) {
                    expect(result.usage?.tokens).toBeGreaterThan(0);
                  }
                });
              },
            );
          },
        );
      }

      if (models.imageModels && models.imageModels.length > 0) {
        describe.each(createModelObjects(models.imageModels))(
          'Image Model: $modelId',
          ({ model, capabilities }) => {
            describeIfCapability(
              capabilities,
              ['imageGeneration'],
              'Image Generation',
              () => {
                it('should generate an image', async () => {
                  const result = await generateImage({
                    model,
                    prompt: 'A cute cartoon cat',
                  });

                  // Verify we got a base64 string back
                  expect(result.image.base64).toBeTruthy();
                  expect(typeof result.image.base64).toBe('string');

                  // Check the decoded length is reasonable (at least 10KB)
                  const decoded = Buffer.from(result.image.base64, 'base64');
                  expect(decoded.length).toBeGreaterThan(10 * 1024);
                });
              },
            );
          },
        );
      }
    });
  };
}
