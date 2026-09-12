'use client';
import * as React from 'react';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useNumberFieldStepperButton } from '../root/useNumberFieldStepperButton';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';

/**
 * A stepper button that decreases the field value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export const NumberFieldDecrement = React.forwardRef(function NumberFieldDecrement(
  componentProps: NumberFieldDecrement.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  return useNumberFieldStepperButton(componentProps, forwardedRef, false);
});

export interface NumberFieldDecrementState extends NumberFieldRootState {}

export interface NumberFieldDecrementProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NumberFieldDecrementState> {}

export namespace NumberFieldDecrement {
  export type State = NumberFieldDecrementState;
  export type Props = NumberFieldDecrementProps;
}
