import { aiSdkCodingHarnessAgent } from '../../agents/claude-code/ai-sdk-coding-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: aiSdkCodingHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Claude Code — AI SDK Coding',
});
