/**
 * Integration tests for WorkflowAgent workflows.
 *
 * Tests exercise WorkflowAgent through the workflow runtime using mock
 * providers. Tests marked it.fails() correspond to known API gaps.
 *
 * Run with: pnpm test:integration
 */
import { describe, expect, it } from 'vitest';
import { start } from 'workflow/api';

import {
  agentBasicE2e,
  agentErrorToolE2e,
  agentInstructionsStringE2e,
  agentMultiStepE2e,
  agentOnFinishE2e,
  agentOnStartE2e,
  agentOnStepFinishE2e,
  agentOnStepStartE2e,
  agentonToolExecutionEndE2e,
  agentonToolExecutionStartE2e,
  agentPrepareCallE2e,
  agentRepairToolCallE2e,
  agentRuntimeAndToolsContextE2e,
  agentSandboxE2e,
  agentTimeoutE2e,
  agentToolApprovalE2e,
  agentToolCallE2e,
  agentToolInputSchemaE2e,
} from './test/agent-e2e-workflows.js';

describe('WorkflowAgent integration', { timeout: 120_000 }, () => {
  // ==========================================================================
  // Core agent tests
  // ==========================================================================

  describe('core', () => {
    it('basic text response', async () => {
      const run = await start(agentBasicE2e, ['hello world']);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({
        stepCount: 1,
        lastStepText: 'Echo: hello world',
      });
    });

    it('single tool call', async () => {
      const run = await start(agentToolCallE2e, [3, 7]);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({ stepCount: 2 });
      expect(rv.lastStepText).toBe('The sum is 10');
    });

    it('multiple sequential tool calls', async () => {
      const run = await start(agentMultiStepE2e, []);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({
        stepCount: 4,
        lastStepText: 'All done!',
      });
    });

    it('tool error recovery', async () => {
      const run = await start(agentErrorToolE2e, []);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({
        stepCount: 2,
        lastStepText: 'Tool failed but I recovered.',
      });
    });
  });

  // ==========================================================================
  // streamModelCall with serializable tool schemas
  // ==========================================================================

  describe('tool input schema serialization', () => {
    it('tools with zod input schemas work across step boundaries', async () => {
      const run = await start(agentToolInputSchemaE2e, [3, 7]);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({ stepCount: 2 });
      expect(rv.lastStepText).toBe('The sum is 10');
    });
  });

  // ==========================================================================
  // repairToolCall serialization
  // ==========================================================================

  describe('repairToolCall', () => {
    it('callback survives serialization and repairs malformed tool input', async () => {
      const run = await start(agentRepairToolCallE2e, []);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({ stepCount: 2, repaired: true });
      expect(rv.lastStepText).toBe('The sum is 10');
    });
  });

  // ==========================================================================
  // onStepFinish callback tests
  // ==========================================================================

  describe('onStepFinish', () => {
    it('fires constructor + stream callbacks in order with step data', async () => {
      const run = await start(agentOnStepFinishE2e, []);
      const rv = await run.returnValue;

      expect(rv.callSources).toEqual(['constructor', 'method']);

      expect(rv.capturedStepResult).toMatchObject({
        text: 'hello',
        finishReason: 'stop',
      });

      expect(rv.stepCount).toBe(1);
    });
  });

  // ==========================================================================
  // onFinish callback tests
  // ==========================================================================

  describe('onFinish', () => {
    it('fires constructor + stream callbacks in order with event data', async () => {
      const run = await start(agentOnFinishE2e, []);
      const rv = await run.returnValue;

      expect(rv.callSources).toEqual(['constructor', 'method']);

      expect(rv.capturedEvent).toMatchObject({
        text: 'hello from finish',
        finishReason: 'stop',
        stepsLength: 1,
        hasMessages: true,
        hasTotalUsage: true,
      });
    });
  });

  // ==========================================================================
  // Instructions test
  // ==========================================================================

  describe('instructions', () => {
    it('string instructions are passed to the model', async () => {
      const run = await start(agentInstructionsStringE2e, []);
      const rv = await run.returnValue;
      expect(rv.stepCount).toBe(1);
      expect(rv.lastStepText).toBe('ok');
    });
  });

  // ==========================================================================
  // Timeout test
  // ==========================================================================

  describe('timeout', () => {
    it('completes within timeout', async () => {
      const run = await start(agentTimeoutE2e, []);
      const rv = await run.returnValue;
      expect(rv).toMatchObject({
        stepCount: 1,
        lastStepText: 'fast response',
      });
    });
  });

  // ==========================================================================
  // GAP tests — these fail until the feature is implemented
  // ==========================================================================

  describe('experimental_onStart (GAP)', () => {
    it('completes but callbacks are not called (GAP)', async () => {
      const run = await start(agentOnStartE2e, []);
      const rv = await run.returnValue;
      // GAP: when implemented, should be ['constructor', 'method']
      expect(rv.callSources).toEqual([]);
    });
  });

  describe('experimental_onStepStart (GAP)', () => {
    it('completes but callbacks are not called (GAP)', async () => {
      const run = await start(agentOnStepStartE2e, []);
      const rv = await run.returnValue;
      // GAP: when implemented, should be ['constructor', 'method']
      expect(rv.callSources).toEqual([]);
    });
  });

  describe('onToolExecutionStart (GAP)', () => {
    it('completes but callbacks are not called (GAP)', async () => {
      const run = await start(agentonToolExecutionStartE2e, []);
      const rv = await run.returnValue;
      // GAP: when implemented, should be ['constructor', 'method']
      expect(rv.calls).toEqual([]);
    });
  });

  describe('onToolExecutionEnd (GAP)', () => {
    it('completes but callbacks are not called (GAP)', async () => {
      const run = await start(agentonToolExecutionEndE2e, []);
      const rv = await run.returnValue;
      // GAP: when implemented, should be ['constructor', 'method']
      expect(rv.calls).toEqual([]);
      // GAP: capturedEvent should have tool result data
      expect(rv.capturedEvent).toBeNull();
    });
  });

  describe('prepareCall (GAP)', () => {
    it('completes but prepareCall is not applied (GAP)', async () => {
      const run = await start(agentPrepareCallE2e, []);
      const rv = await run.returnValue;
      expect(rv.stepCount).toBe(1);
    });
  });

  describe('tool approval (GAP)', () => {
    it('completes but needsApproval is not checked (GAP)', async () => {
      const run = await start(agentToolApprovalE2e, []);
      const rv = await run.returnValue;
      // GAP: when tool approval is implemented, the agent should pause
      // with toolCallsCount=1 and toolResultsCount=0 (awaiting approval).
      // Currently needsApproval is ignored, so the tool executes immediately.
      expect(rv.stepCount).toBe(2);
    });
  });

  describe('runtimeContext + toolsContext', () => {
    it('flows through prepareStep, tool execute, and onFinish', async () => {
      const run = await start(agentRuntimeAndToolsContextE2e, []);
      const rv = await run.returnValue;

      expect(rv.stepCount).toBe(2);
      expect(rv.lastStepText).toBe('Customer cust_123 is eligible.');

      // Tool received only its own validated context entry, not the
      // full runtimeContext or toolsContext map.
      expect(rv.toolReceivedContext).toEqual({
        apiKey: 'sk-test-key',
        region: 'us',
      });

      // prepareStep updated runtimeContext between steps; onFinish saw it.
      expect(rv.onFinishRuntimeContext).toMatchObject({
        tenantId: 'tenant_123',
        requestId: 'req_abc',
        lastStep: expect.any(Number),
      });
      expect(rv.onFinishToolsContext).toEqual({
        lookupCustomer: { apiKey: 'sk-test-key', region: 'us' },
      });
    });
  });

  describe('experimental_sandbox', () => {
    it('flows through to tool execute', async () => {
      const run = await start(agentSandboxE2e, []);
      const rv = await run.returnValue;

      expect(rv.stepCount).toBe(2);
      expect(rv.lastStepText).toBe('Command executed.');
      expect(rv.constructorSandboxRanCommand).toBe('not-run');
      expect(rv.stepSandboxRanCommand).toBe('echo hello');
      expect(rv.firstPrepareStepSawConstructorSandbox).toBe(true);
      expect(rv.secondPrepareStepSawConstructorSandbox).toBe(true);
      expect(rv.prepareStepSawStepSandbox).toBe(false);
      expect(rv.toolResults[0]?.output).toMatchObject({
        stdout: 'ran: echo hello',
      });
    });
  });
});
