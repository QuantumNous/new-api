'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectItemContext } from '../item/SelectItemContext';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectItemIndicator = React.forwardRef(function SelectItemIndicator(
  componentProps: SelectItemIndicator.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const keepMounted = componentProps.keepMounted ?? false;

  const { selected } = useSelectItemContext();

  const shouldRender = keepMounted || selected;
  if (!shouldRender) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return <Inner {...componentProps} ref={forwardedRef} />;
});

// Split the core implementation to avoid paying the hook costs unless the element needs to mount.
const Inner = React.memo(
  React.forwardRef(
    (
      componentProps: SelectItemIndicator.Props,
      forwardedRef: React.ForwardedRef<HTMLSpanElement>,
    ) => {
      const { render, className, style, keepMounted, ...elementProps } = componentProps;

      const { selected } = useSelectItemContext();

      const indicatorRef = React.useRef<HTMLSpanElement | null>(null);

      const { transitionStatus, setMounted } = useTransitionStatus(selected);

      const state: SelectItemIndicatorState = {
        selected,
        transitionStatus,
      };

      const element = useRenderElement('span', componentProps, {
        ref: [forwardedRef, indicatorRef],
        state,
        props: [
          {
            'aria-hidden': true,
            children: '✔️',
          },
          elementProps,
        ],
        stateAttributesMapping: transitionStatusMapping,
      });

      useOpenChangeComplete({
        open: selected,
        ref: indicatorRef,
        onComplete() {
          if (!selected) {
            setMounted(false);
          }
        },
      });

      return element;
    },
  ),
);

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps extends BaseUIComponentProps<
  'span',
  SelectItemIndicatorState
> {
  children?: React.ReactNode;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
