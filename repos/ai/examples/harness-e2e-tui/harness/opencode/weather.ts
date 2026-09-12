import { weatherOpenCodeHarnessAgent } from '../../agents/opencode/weather-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherOpenCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'OpenCode — Weather',
});
