import { aiSdkCodingPiHarnessAgent } from '../../agents/pi/ai-sdk-coding-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: aiSdkCodingPiHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Pi — AI SDK Coding',
});
