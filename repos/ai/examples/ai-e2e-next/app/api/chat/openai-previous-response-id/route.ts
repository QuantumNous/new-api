import {
  openai,
  type OpenaiResponsesProviderMetadata,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type InferUITools,
  type UIMessage,
} from 'ai';
import { rollDieToolWithProgrammaticCalling } from '@/tool/roll-die-tool-with-programmatic-calling';

const tools = {
  rollDieToolWithProgrammaticCalling,
};

type Tools = InferUITools<typeof tools>;
type Data = {
  providerMetadata: OpenaiResponsesProviderMetadata;
};

export type PreviousResponseIdUIMessage = UIMessage<unknown, Data, Tools>;

export type PreviousResponseIdRequestBody = {
  message: PreviousResponseIdUIMessage;
  previousProviderMetadata: OpenaiResponsesProviderMetadata | undefined;
};

export async function POST(req: Request) {
  const reqJson = await req.json();

  const { message, previousProviderMetadata } =
    reqJson as PreviousResponseIdRequestBody;

  // Extract the prior OpenAI responseId so the Responses API can replay history.
  const previousResponseId: string | null | undefined =
    !!previousProviderMetadata
      ? previousProviderMetadata.openai.responseId
      : undefined;

  const stream = createUIMessageStream<PreviousResponseIdUIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: openai('gpt-5-mini'),
        // Send only the latest user message; OpenAI will fetch prior turns via previousResponseId.
        messages: await convertToModelMessages([message]),
        tools,
        stopWhen: isStepCount(20),
        reasoning: 'low',
        providerOptions: {
          openai: {
            reasoningSummary: 'auto',
            store: true,
            // Enable history lookup by passing the responseId from the previous call.
            previousResponseId,
          } satisfies OpenAILanguageModelResponsesOptions,
        },
        onEnd: ({ finalStep }) => {
          const providerMetadata = finalStep.providerMetadata;

          if (!!providerMetadata) {
            // Return provider metadata so the client can persist the latest responseId.
            writer.write({
              type: 'data-providerMetadata',
              data: providerMetadata as OpenaiResponsesProviderMetadata,
              transient: true,
            });
          }
        },
      });
      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
