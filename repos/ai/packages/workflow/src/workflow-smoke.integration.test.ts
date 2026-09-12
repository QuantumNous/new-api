import { describe, it, expect } from 'vitest';
import { start } from 'workflow/api';
import { calculateWorkflow } from './test/calculate-workflow.js';

describe('calculateWorkflow', () => {
  it('should compute the correct result', async () => {
    const run = await start(calculateWorkflow, [2, 7]);
    expect(run.runId).toMatch(/^wrun_/);

    const result = await run.returnValue;
    expect(result).toEqual({
      sum: 9,
      product: 14,
      combined: 23,
    });

    const status = await run.status;
    expect(status).toEqual('completed');
  });
});
