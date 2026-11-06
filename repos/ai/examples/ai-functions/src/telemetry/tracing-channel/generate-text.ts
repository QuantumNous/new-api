import { tracingChannel } from 'node:diagnostics_channel';
import {
  AI_SDK_TELEMETRY_TRACING_CHANNEL,
  generateText,
  gateway,
  type TelemetryTracingChannelMessage,
} from 'ai';
import { run } from '../../lib/run';

tracingChannel(AI_SDK_TELEMETRY_TRACING_CHANNEL).subscribe({
  start(message) {
    const telemetry = message as TelemetryTracingChannelMessage;

    console.log(
      `[tracing-channel] ${telemetry.type}`,
      JSON.stringify(telemetry.event, null, 2),
    );
  },
  end() {},
  asyncStart() {},
  asyncEnd() {},
  error() {},
});

run(async () => {
  await generateText({
    model: gateway('openai/gpt-5-nano'),
    prompt: 'Say hello in 5 words.',
    telemetry: {
      functionId: 'tracing-channel-example',
    },
  });
});
