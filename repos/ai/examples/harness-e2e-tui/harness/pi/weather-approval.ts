import { weatherApprovalPiHarnessAgent } from '../../agents/pi/weather-approval-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherApprovalPiHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Pi — Weather Approval',
});
