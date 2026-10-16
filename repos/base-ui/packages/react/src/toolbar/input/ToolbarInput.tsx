'use client';
import * as React from 'react';
import { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import type { ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export const ToolbarInput = React.forwardRef(function ToolbarInput(
  componentProps: ToolbarInput.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const {
    className,
    focusableWhenDisabled = true,
    render,
    disabled: disabledProp = false,
    style,
    ...elementProps
  } = componentProps;

  const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();

  const groupContext = useToolbarGroupContext(true);

  const disabled = toolbarDisabled || (groupContext?.disabled ?? false) || disabledProp;

  const itemMetadata = React.useMemo(
    () => ({ disabled, focusableWhenDisabled }),
    [disabled, focusableWhenDisabled],
  );

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    composite: true,
    disabled,
    focusableWhenDisabled,
    isNativeButton: false,
  });

  const state: ToolbarInputState = {
    disabled,
    orientation,
    focusable: focusableWhenDisabled,
  };

  const defaultProps: HTMLProps = {
    onClick(event) {
      if (disabled) {
        event.preventDefault();
      }
    },
    onPointerDown(event) {
      if (disabled) {
        event.preventDefault();
      }
    },
  };

  return (
    <CompositeItem
      tag="input"
      render={render}
      className={className}
      style={style}
      metadata={itemMetadata}
      state={state}
      refs={[forwardedRef]}
      props={[defaultProps, elementProps, focusableWhenDisabledProps]}
    />
  );
});

export interface ToolbarInputState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarInputProps extends BaseUIComponentProps<'input', ToolbarInputState> {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
  defaultValue?: React.ComponentProps<'input'>['defaultValue'] | undefined;
}

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props = ToolbarInputProps;
}
