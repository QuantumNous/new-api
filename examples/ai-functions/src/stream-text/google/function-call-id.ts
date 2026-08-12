import { google } from '@ai-sdk/google';
import { isStepCount, streamText, type ModelMessage } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

/*
 * Exercises Gemini 3's parallel function calling across two turns via
 * streaming. Gemini 3 emits an `id` on each `functionCall` part. The matching
 * `functionResponse` parts we send back in turn 2 should carry the same `id`
 * so the model can correlate each response to its call. If we drop the id on
 * either side, the API may reject the request or the model may mis-correlate
 * parallel calls.
 */
run(async () => {
  const messages: Array<ModelMessage> = [
    {
      role: 'user',
      content:
        'In parallel, get the weather for San Francisco, London, and Tokyo. ' +
        'Call the weather tool three times, one per city.',
    },
  ];

  // Turn 1: model emits parallel tool calls; tools execute automatically.
  const turn1 = streamText({
    model: google('gemini-3.5-flash'),
    tools: { weather: weatherTool },
    messages,
    stopWhen: isStepCount(1),
  });

  for await (const part of turn1.stream) {
    if (part.type === 'tool-call') {
      console.log(
        `Turn 1 tool call (${part.toolCallId}): ${part.toolName}`,
        JSON.stringify(part.input),
      );
    } else if (part.type === 'tool-result') {
      console.log(
        `Turn 1 tool result (${part.toolCallId}):`,
        JSON.stringify(part.output),
      );
    }
  }

  messages.push(...(await turn1.finalStep).response.messages);
  messages.push({
    role: 'user',
    content:
      'Now summarize those three results in a single sentence, sorted from ' +
      'coldest to warmest.',
  });

  // Turn 2: send the parallel tool results back. Gemini 3 expects the ids
  // it issued in turn 1 to round-trip on the corresponding functionResponse
  // parts. Without the provider plumbing the id through, this turn fails.
  const turn2 = streamText({
    model: google('gemini-3-flash-preview'),
    tools: { weather: weatherTool },
    messages,
  });

  console.log('\nTurn 2 text:');
  for await (const part of turn2.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }
  console.log();
});
