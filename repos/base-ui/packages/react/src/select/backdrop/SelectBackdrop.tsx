'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { selectors } from '../store';

const stateAttributesMapping: StateAttributesMapping<SelectBackdropState> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
};

/**
 * An overlay displayed beneath the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectBackdrop = React.forwardRef(function SelectBackdrop(
  componentProps: SelectBackdrop.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const { store } = useSelectRootContext();

  const open = useStore(store, selectors.open);
  const mounted = useStore(store, selectors.mounted);
  const transitionStatus = useStore(store, selectors.transitionStatus);

  const state: SelectBackdropState = {
    open,
    transitionStatus,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
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
    stateAttributesMapping,
  });

  return element;
});

export interface SelectBackdropState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectBackdropProps extends BaseUIComponentProps<'div', SelectBackdropState> {}

export namespace SelectBackdrop {
  export type State = SelectBackdropState;
  export type Props = SelectBackdropProps;
}
