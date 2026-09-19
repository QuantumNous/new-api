import { safeValidateTypes } from '@ai-sdk/provider-utils';
import { HarnessError } from '../../errors/harness-error';
import type { HarnessV1, HarnessV1LifecycleState } from '../../v1';

/**
 * Validate a lifecycle state against the harness's contract:
 *  - `type` must match the lifecycle method that will consume it.
 *  - `specificationVersion` must be `'harness-v1'`.
 *  - `harnessId` must match the harness producing/consuming the payload.
 *  - When the harness declares a `lifecycleStateSchema`, `data` is parsed
 *    against it.
 *
 * Returns the payload with `data` replaced by the parsed value when a
 * schema is present, so callers downstream see a canonical shape.
 */
export async function validateLifecycleStateData<
  STATE extends HarnessV1LifecycleState,
>(input: {
  harness: HarnessV1;
  state: STATE;
  expectedType: STATE['type'];
}): Promise<STATE> {
  const { harness, state } = input;
  if (state.type !== input.expectedType) {
    throw new HarnessError({
      message: `Lifecycle state has unexpected type '${state.type}'; expected '${input.expectedType}'.`,
    });
  }
  if (state.specificationVersion !== 'harness-v1') {
    throw new HarnessError({
      message: `Lifecycle state has unexpected specificationVersion '${state.specificationVersion}'; expected 'harness-v1'.`,
    });
  }
  if (state.harnessId !== harness.harnessId) {
    throw new HarnessError({
      message: `Lifecycle state was produced by harness '${state.harnessId}' but this agent uses '${harness.harnessId}'.`,
    });
  }
  if (
    state.type === 'resume-session' &&
    'pendingToolApprovals' in state &&
    state.pendingToolApprovals !== undefined
  ) {
    throw new HarnessError({
      message:
        'Resume session state cannot contain pending tool approvals; unfinished turns must be stored as `continueFrom`.',
    });
  }

  const data =
    harness.lifecycleStateSchema == null
      ? state.data
      : await (async () => {
          const result = await safeValidateTypes({
            value: state.data,
            schema: harness.lifecycleStateSchema!,
          });
          if (!result.success) {
            throw new HarnessError({
              message: `Lifecycle state failed schema validation for harness '${harness.harnessId}': ${result.error.message}`,
              cause: result.error,
            });
          }
          return result.value as STATE['data'];
        })();

  if (state.type === 'resume-session') {
    const continueFrom =
      state.continueFrom == null
        ? undefined
        : await validateLifecycleStateData({
            harness,
            state: state.continueFrom,
            expectedType: 'continue-turn',
          });

    return {
      type: state.type,
      harnessId: state.harnessId,
      specificationVersion: state.specificationVersion,
      data,
      ...(continueFrom !== undefined ? { continueFrom } : {}),
    } as STATE;
  }

  return {
    type: state.type,
    harnessId: state.harnessId,
    specificationVersion: state.specificationVersion,
    data,
    ...(state.pendingToolApprovals !== undefined
      ? { pendingToolApprovals: state.pendingToolApprovals }
      : {}),
  } as STATE;
}
