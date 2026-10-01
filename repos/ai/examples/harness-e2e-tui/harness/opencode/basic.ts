import { openCodeHarnessAgent } from '../../agents/opencode/basic-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: openCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'OpenCode — Basic',
});
