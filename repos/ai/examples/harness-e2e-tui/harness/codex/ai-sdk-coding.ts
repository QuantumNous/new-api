import { aiSdkCodingCodexHarnessAgent } from '../../agents/codex/ai-sdk-coding-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: aiSdkCodingCodexHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Codex — AI SDK Coding',
});
