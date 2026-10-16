import {
  bedrockAnthropic,
  createBedrockAnthropic,
} from '@ai-sdk/amazon-bedrock/anthropic';
import type { LanguageModelV3, LanguageModelV4 } from '@ai-sdk/provider';
import { generateText, isStepCount, type APICallError } from 'ai';
import 'dotenv/config';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
  type ModelWithCapabilities,
} from './feature-test-suite';
const createModelObject = (
  model: LanguageModelV4,
): { model: LanguageModelV4; modelId: string } => ({
  model: model,
  modelId: model.modelId,
});

const createLanguageModel = (
  modelId: string,
  additionalTests: ((model: LanguageModelV4) => void)[] = [],
): ModelWithCapabilities<LanguageModelV3 | LanguageModelV4> => {
  const model = createBedrockAnthropic({
    region: process.env.AWS_REGION ?? 'us-east-1',
  })(modelId);

  if (additionalTests.length > 0) {
    describe.each([createModelObject(model)])(
      'Provider-specific tests: $modelId',
      ({ model }) => {
        additionalTests.forEach(test => test(model));
      },
    );
  }

  return createLanguageModelWithCapabilities(model);
};

const createModelVariants = (
  modelId: string,
  tests: ((model: LanguageModelV4) => void)[] = [],
): ModelWithCapabilities<LanguageModelV3 | LanguageModelV4>[] => [
  createLanguageModel(modelId, tests),
];

// Model variants to test against
const CHAT_MODELS = ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'];

// Sonnet 4.5 supports computer use tools
const COMPUTER_USE_MODELS = ['us.anthropic.claude-sonnet-4-5-20250929-v1:0'];

const createModelsForRuntime = () => ({
  languageModels: [
    ...CHAT_MODELS.flatMap(modelId =>
      createModelVariants(modelId, [stopSequenceTests]),
    ),
    ...COMPUTER_USE_MODELS.flatMap(modelId =>
      createModelVariants(modelId, [toolTests]),
    ),
  ],
});

const LONG_TEST_MILLIS = 30000;
const COMPUTER_USE_TEST_MILLIS = 45000;

describe('Bedrock Anthropic E2E Tests', () => {
  createFeatureTestSuite({
    name: 'Bedrock Anthropic',
    models: createModelsForRuntime(),
    timeout: LONG_TEST_MILLIS,
    customAssertions: {
      skipUsage: false,
      errorValidator: (error: APICallError) => {
        expect(error.message).toMatch(
          /ValidationException|ResourceNotFoundException/,
        );
      },
    },
  })();
});

const stopSequenceTests = (model: LanguageModelV4) => {
  it(
    'should return stop_sequence in provider metadata when stopped by stop sequence',
    async () => {
      const result = await generateText({
        model,
        prompt: 'Count from 1 to 10, one number per line.',
        stopSequences: ['5'],
      });

      expect(result.text).toBeTruthy();
      expect(result.text).not.toContain('6');
      expect(result.finishReason).toBe('stop');
      expect(result.providerMetadata?.anthropic?.stopSequence).toBe('5');
    },
    LONG_TEST_MILLIS,
  );

  it(
    'should return null stopSequence when not stopped by stop sequence',
    async () => {
      const result = await generateText({
        model,
        prompt: 'Say hello.',
        maxOutputTokens: 50,
      });

      expect(result.text).toBeTruthy();
      expect(result.providerMetadata?.anthropic?.stopSequence).toBeNull();
    },
    LONG_TEST_MILLIS,
  );
};

const toolTests = (model: LanguageModelV4) => {
  it(
    'should execute computer tool commands',
    async () => {
      const result = await generateText({
        model,
        tools: {
          computer: bedrockAnthropic.tools.computer_20241022({
            displayWidthPx: 1024,
            displayHeightPx: 768,
            async execute({ action, coordinate, text }) {
              switch (action) {
                case 'screenshot': {
                  return {
                    type: 'file',
                    mediaType: 'image',
                    data: fs
                      .readFileSync('./data/screenshot-editor.png')
                      .toString('base64'),
                  };
                }
                default: {
                  return `executed ${action}`;
                }
              }
            },
            toModelOutput({ output }) {
              return {
                type: 'content',
                value: [
                  typeof output === 'string'
                    ? { type: 'text', text: output }
                    : {
                        type: 'file',
                        mediaType: 'image/png',
                        data: { type: 'data', data: output.data },
                      },
                ],
              };
            },
          }),
        },
        prompt:
          'How can I switch to dark mode? Take a look at the screen and tell me.',
        stopWhen: isStepCount(5),
      });

      console.log(result.text);
      expect(result.text).toBeTruthy();
      // Model should respond about the screen - check for common terms
      expect(result.text.toLowerCase()).toMatch(
        /settings|theme|dark|mode|interface|screen|editor|code|vs\s?code/i,
      );
      expect(result.usage?.totalTokens).toBeGreaterThan(0);
    },
    COMPUTER_USE_TEST_MILLIS,
  );

  it(
    'should execute bash tool commands',
    async () => {
      const result = await generateText({
        model,
        tools: {
          bash: bedrockAnthropic.tools.bash_20241022({
            async execute({ command }) {
              return [
                {
                  type: 'text',
                  text: `
❯ ${command}
README.md     build         data          node_modules  package.json  src           tsconfig.json
`,
                },
              ];
            },
          }),
        },
        prompt: 'List the files in my directory.',
        stopWhen: isStepCount(2),
      });

      expect(result.text).toBeTruthy();
      expect(result.text).toContain('README.md');
      expect(result.text).toContain('package.json');
      expect(result.text).toContain('node_modules');
      expect(result.usage?.totalTokens).toBeGreaterThan(0);
    },
    COMPUTER_USE_TEST_MILLIS,
  );

  it(
    'should execute text editor tool commands',
    async () => {
      let editorContent = '## README\nThis is a test file.';

      const result = await generateText({
        model,
        tools: {
          str_replace_editor: bedrockAnthropic.tools.textEditor_20241022({
            async execute({ command, path, old_str, new_str, insert_text }) {
              switch (command) {
                case 'view': {
                  return editorContent;
                }
                case 'create': {
                  editorContent = new_str!;
                  return editorContent;
                }
                case 'insert': {
                  editorContent = insert_text!;
                  return editorContent;
                }
                case 'str_replace': {
                  editorContent = editorContent.replace(old_str!, new_str!);
                  return editorContent;
                }
                default:
                  return '';
              }
            },
          }),
        },
        prompt: 'Update my README file to talk about AI.',
        stopWhen: isStepCount(5),
      });

      expect(result.text).toBeTruthy();
      expect(editorContent).not.toBe('## README\nThis is a test file.');
      expect(result.usage?.totalTokens).toBeGreaterThan(0);
    },
    COMPUTER_USE_TEST_MILLIS,
  );
};
