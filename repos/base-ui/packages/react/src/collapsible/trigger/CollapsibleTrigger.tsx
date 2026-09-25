'use client';
import * as React from 'react';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import { type CollapsibleRootState } from '../root/CollapsibleRoot';

const stateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export const CollapsibleTrigger = React.forwardRef(function CollapsibleTrigger(
  componentProps: CollapsibleTrigger.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  const {
    panelId,
    open,
    handleTrigger,
    state,
    disabled: contextDisabled,
  } = useCollapsibleRootContext();

  const {
    className,
    disabled = contextDisabled,
    render,
    nativeButton = true,
    style,
    ...elementProps
  } = componentProps;

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
  });

  const element = useRenderElement('button', componentProps, {
    state,
    ref: [forwardedRef, buttonRef],
    props: [
      {
        'aria-controls': open ? panelId : undefined,
        'aria-expanded': open,
        onClick: handleTrigger,
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });

  return element;
});

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', CollapsibleTriggerState> {}

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props = CollapsibleTriggerProps;
}
