import type { FieldValidityData } from '../root/FieldRoot';

/**
 * Combines the field's client-side, stateful validity data with the external invalid state to
 * determine the field's true validity.
 */
export function getCombinedFieldValidityData(
  validityData: FieldValidityData,
  invalid: boolean | undefined,
) {
  return {
    ...validityData,
    state: {
      ...validityData.state,
      valid: !invalid && validityData.state.valid,
    },
  };
}
