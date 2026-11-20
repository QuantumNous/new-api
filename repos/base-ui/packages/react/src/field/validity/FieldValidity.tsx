'use client';
import * as React from 'react';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { FieldValidityData } from '../root/FieldRoot';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';

/**
 * Used to display a custom message based on the field's validity.
 * Requires `children` to be a function that accepts field validity state as an argument.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export const FieldValidity: React.FC<FieldValidity.Props> = function FieldValidity(props) {
  const { children } = props;

  const { validityData, invalid } = useFieldRootContext(false);

  const combinedFieldValidityData = React.useMemo(
    () => getCombinedFieldValidityData(validityData, invalid),
    [validityData, invalid],
  );
  const isInvalid = combinedFieldValidityData.state.valid === false;
  const { transitionStatus } = useTransitionStatus(isInvalid);

  const fieldValidityState: FieldValidityState = React.useMemo(() => {
    return {
      ...combinedFieldValidityData,
      validity: combinedFieldValidityData.state,
      transitionStatus,
    };
  }, [combinedFieldValidityData, transitionStatus]);

  return <React.Fragment>{children(fieldValidityState)}</React.Fragment>;
};

export interface FieldValidityState extends Omit<FieldValidityData, 'state'> {
  /**
   * The validity state.
   */
  validity: FieldValidityData['state'];
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldValidityProps {
  /**
   * A function that accepts the field validity state as an argument.
   *
   * ```jsx
   * <Field.Validity>
   *   {(validity) => {
   *     return <div>...</div>
   *   }}
   * </Field.Validity>
   * ```
   */
  children: (state: FieldValidityState) => React.ReactNode;
}

export namespace FieldValidity {
  export type State = FieldValidityState;
  export type Props = FieldValidityProps;
}
