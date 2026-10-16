import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const openaiCompatible = createOpenAICompatible({
    name: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY ?? 'YOUR_API_KEY',
  });

  const connectionTimeout = 50;
  const manualCancelTimeout = 5000;

  try {
    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(connectionTimeout);
    const finalSignal = AbortSignal.any([
      timeoutSignal,
      abortController.signal,
    ]);

    const result = streamText({
      model: openaiCompatible('deepseek-chat'),
      prompt: 'Write a short poem about a lighthouse.',
      abortSignal: finalSignal,
    });

    // Abort manually after the timeout to show timeout reason first.
    setTimeout(() => {
      abortController.abort('user cancelled');
    }, manualCancelTimeout);

    for await (const chunk of result.stream) {
      if (chunk.type === 'abort') {
        const reason = chunk.reason;
        console.log('Abort reason:', reason);
        break;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('\n\nAbortError: The run was aborted.');
    }
  }
});
