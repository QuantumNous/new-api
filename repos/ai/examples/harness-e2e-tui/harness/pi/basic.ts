import { piHarnessAgent } from '../../agents/pi/basic-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: piHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Pi — Basic',
});
