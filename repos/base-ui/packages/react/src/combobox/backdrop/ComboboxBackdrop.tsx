'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import type { BaseUIComponentProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { selectors } from '../store';

const stateAttributesMapping: StateAttributesMapping<ComboboxBackdropState> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
};

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxBackdrop = React.forwardRef(function ComboboxBackdrop(
  componentProps: ComboboxBackdrop.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const store = useComboboxRootContext();

  const open = useStore(store, selectors.open);
  const mounted = useStore(store, selectors.mounted);
  const transitionStatus = useStore(store, selectors.transitionStatus);

  const state: ComboboxBackdropState = {
    open,
    transitionStatus,
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    stateAttributesMapping,
    props: [
      {
        role: 'presentation',
        hidden: !mounted,
        style: {
          userSelect: 'none',
          WebkitUserSelect: 'none',
        },
      },
      elementProps,
    ],
  });
});

export interface ComboboxBackdropProps extends BaseUIComponentProps<'div', ComboboxBackdropState> {}

export interface ComboboxBackdropState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace ComboboxBackdrop {
  export type Props = ComboboxBackdropProps;
  export type State = ComboboxBackdropState;
}
