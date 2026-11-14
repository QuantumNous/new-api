import type {
  HarnessAgentAdapter,
  HarnessAgentSettings,
} from '@ai-sdk/harness/agent';
import { assertType, describe, expectTypeOf, test } from 'vitest';
import { claudeCode, createClaudeCode } from './index';

/*
 * Regression guard for the harness Zod compatibility contract: a concrete
 * `HarnessV1` adapter (with its real, schema-typed `builtinTools`) must stay
 * assignable to the type `HarnessAgent` expects for its `harness` setting,
 * independent of which supported Zod version the consumer has installed. The
 * adapter's tool input schemas are normalized to `FlexibleSchema` by `tool()`,
 * so no concrete Zod-version type should leak into this surface.
 */
describe('claudeCode ↔ HarnessAgent harness setting', () => {
  test('claudeCode satisfies the HarnessAgent adapter constraint', () => {
    expectTypeOf(claudeCode).toExtend<HarnessAgentAdapter<any>>();
    expectTypeOf(createClaudeCode()).toExtend<HarnessAgentAdapter<any>>();
  });

  test('claudeCode is assignable to the HarnessAgent `harness` setting', () => {
    assertType<HarnessAgentSettings['harness']>(claudeCode);
    assertType<HarnessAgentSettings['harness']>(createClaudeCode());
  });

  test('the constructor generic constraint accepts claudeCode', () => {
    // Mirrors `HarnessAgent`'s `THarness extends HarnessAgentAdapter<any>`.
    const acceptsHarness = <THarness extends HarnessAgentAdapter<any>>(
      harness: THarness,
    ): THarness => harness;

    assertType<typeof claudeCode>(acceptsHarness(claudeCode));
  });
});
