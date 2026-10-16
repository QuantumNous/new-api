'use client';
import * as React from 'react';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { type StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';

const stateAttributesMapping: StateAttributesMapping<PreviewCardBackdropState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export const PreviewCardBackdrop = React.forwardRef(function PreviewCardBackdrop(
  componentProps: PreviewCardBackdrop.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const store = usePreviewCardRootContext();
  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');

  const state: PreviewCardBackdropState = {
    open,
    transitionStatus,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef],
    props: [
      {
        role: 'presentation',
        hidden: !mounted,
        style: {
          pointerEvents: 'none',
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

export interface PreviewCardBackdropState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PreviewCardBackdropProps extends BaseUIComponentProps<
  'div',
  PreviewCardBackdropState
> {}

export namespace PreviewCardBackdrop {
  export type State = PreviewCardBackdropState;
  export type Props = PreviewCardBackdropProps;
}
