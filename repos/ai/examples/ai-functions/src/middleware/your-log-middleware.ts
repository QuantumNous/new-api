import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { LanguageModelMiddleware } from 'ai';

export const yourLogMiddleware: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    console.log('doGenerate called');
    console.log(`params: ${JSON.stringify(params, null, 2)}`);

    const result = await doGenerate();

    console.log('doGenerate finished');
    console.log(`generated content: ${JSON.stringify(result.content)}`);

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    console.log('doStream called');
    console.log(`params: ${JSON.stringify(params, null, 2)}`);

    const { stream, ...rest } = await doStream();

    let generatedText = '';

    const transformStream = new TransformStream<
      LanguageModelV4StreamPart,
      LanguageModelV4StreamPart
    >({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          generatedText += chunk.delta;
        }

        controller.enqueue(chunk);
      },

      flush() {
        console.log('doStream finished');
        console.log(`generated text: ${generatedText}`);
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
