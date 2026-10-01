import { codexHarnessAgent } from '../../agents/codex/basic-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: codexHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Codex — Basic',
});
