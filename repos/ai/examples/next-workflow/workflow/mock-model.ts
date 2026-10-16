import {
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';

export type MockResponseDescriptor =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolName: string; input: string }
  | { type: 'error'; message: string };

const usage = {
  inputTokens: {
    total: 5,
    noCache: 5,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

type MockStreamOptions = Parameters<MockLanguageModelV4['doStream']>[0];
type MockStreamResult = Awaited<ReturnType<MockLanguageModelV4['doStream']>>;
type MockStreamPart = MockStreamResult extends {
  stream: ReadableStream<infer PART>;
}
  ? PART
  : never;

class SerializableMockLanguageModel extends MockLanguageModelV4 {
  static [WORKFLOW_SERIALIZE](model: SerializableMockLanguageModel) {
    return { responses: model.responses };
  }

  static [WORKFLOW_DESERIALIZE](options: {
    responses: MockResponseDescriptor[];
  }) {
    return new SerializableMockLanguageModel(options.responses);
  }

  constructor(private readonly responses: MockResponseDescriptor[]) {
    super({
      provider: 'workflow-telemetry-mock',
      modelId: 'workflow-telemetry-model',
      doStream: async (options: MockStreamOptions) => {
        const index = Math.min(
          options.prompt.filter(message => message.role === 'assistant').length,
          responses.length - 1,
        );
        const response = responses[index];

        if (response.type === 'error') {
          throw new Error(response.message);
        }

        const prefix: MockStreamPart[] = [
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: `response-${index}`,
            modelId: 'workflow-telemetry-model',
            timestamp: new Date('2026-05-06T00:00:00.000Z'),
          },
        ];

        const streamParts: MockStreamPart[] =
          response.type === 'text'
            ? [
                ...prefix,
                { type: 'text-start', id: `text-${index}` },
                {
                  type: 'text-delta',
                  id: `text-${index}`,
                  delta: response.text,
                },
                { type: 'text-end', id: `text-${index}` },
                {
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: 'stop' },
                  usage,
                },
              ]
            : [
                ...prefix,
                {
                  type: 'tool-call',
                  toolCallId: `call-${index + 1}`,
                  toolName: response.toolName,
                  input: response.input,
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  usage,
                },
              ];

        return {
          stream: convertArrayToReadableStream(streamParts),
        };
      },
    });
  }
}

export function mockSequenceModel(responses: MockResponseDescriptor[]) {
  return new SerializableMockLanguageModel(responses);
}
