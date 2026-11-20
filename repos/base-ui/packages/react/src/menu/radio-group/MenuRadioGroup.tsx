'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { MenuRadioGroupContext } from './MenuRadioGroupContext';
import { MenuGroupContext } from '../group/MenuGroupContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { MenuRoot } from '../root/MenuRoot';

/**
 * Groups related radio items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export const MenuRadioGroup = React.memo(
  React.forwardRef(function MenuRadioGroup(
    componentProps: MenuRadioGroup.Props,
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) {
    const {
      render,
      className,
      value: valueProp,
      defaultValue,
      onValueChange: onValueChangeProp,
      disabled = false,
      style,
      'aria-labelledby': ariaLabelledByProp,
      ...elementProps
    } = componentProps;

    const [labelId, setLabelId] = React.useState<string | undefined>(undefined);

    const [value, setValueUnwrapped] = useControlled({
      controlled: valueProp,
      default: defaultValue,
      name: 'MenuRadioGroup',
    });

    const setValue = useStableCallback(
      (newValue: any, eventDetails: MenuRadioGroup.ChangeEventDetails) => {
        onValueChangeProp?.(newValue, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        setValueUnwrapped(newValue);
      },
    );

    const state: MenuRadioGroupState = { disabled };

    const element = useRenderElement('div', componentProps, {
      state,
      ref: forwardedRef,
      props: {
        role: 'group',
        'aria-labelledby': ariaLabelledByProp ?? labelId,
        'aria-disabled': disabled || undefined,
        ...elementProps,
      },
    });

    const context: MenuRadioGroupContext = React.useMemo(
      () => ({
        value,
        setValue,
        disabled,
      }),
      [value, setValue, disabled],
    );

    return (
      <MenuGroupContext.Provider value={setLabelId}>
        <MenuRadioGroupContext.Provider value={context}>{element}</MenuRadioGroupContext.Provider>
      </MenuGroupContext.Provider>
    );
  }),
);

export interface MenuRadioGroupProps extends BaseUIComponentProps<'div', MenuRadioGroupState> {
  /**
   * The content of the component.
   */
  children?: React.ReactNode;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: any;
  /**
   * The uncontrolled value of the radio item that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: any;
  /**
   * Function called when the selected value changes.
   */
  onValueChange?:
    | ((value: any, eventDetails: MenuRadioGroup.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the component should ignore user interaction.
   *
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenuRadioGroupState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
}

export type MenuRadioGroupChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuRadioGroupChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuRadioGroup {
  export type Props = MenuRadioGroupProps;
  export type State = MenuRadioGroupState;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}
