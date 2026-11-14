import { aiSdkCodingOpenCodeHarnessAgent } from '../../agents/opencode/ai-sdk-coding-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: aiSdkCodingOpenCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'OpenCode — AI SDK Coding',
});
