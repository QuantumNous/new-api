'use client';
import type * as React from 'react';
import { ComboboxTrigger } from '../../combobox/trigger/ComboboxTrigger';
import type { FieldRootState } from '../../field/root/FieldRoot';
import type { Side } from '../../utils/useAnchorPositioning';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export const AutocompleteTrigger = ComboboxTrigger as AutocompleteTrigger;

export interface AutocompleteTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
}

export interface AutocompleteTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', AutocompleteTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface AutocompleteTrigger {
  (
    componentProps: AutocompleteTriggerProps & React.RefAttributes<HTMLButtonElement>,
  ): React.JSX.Element;
}

export namespace AutocompleteTrigger {
  export type State = AutocompleteTriggerState;
  export type Props = AutocompleteTriggerProps;
}
