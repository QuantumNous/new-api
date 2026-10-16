'use client';
import * as React from 'react';
import { useMenuCheckboxItemContext } from '../checkbox-item/MenuCheckboxItemContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { BaseUIComponentProps } from '../../internals/types';
import { itemMapping } from '../utils/stateAttributesMapping';
import { TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';

/**
 * Indicates whether the checkbox item is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export const MenuCheckboxItemIndicator = React.forwardRef(function MenuCheckboxItemIndicator(
  componentProps: MenuCheckboxItemIndicator.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { render, className, style, keepMounted = false, ...elementProps } = componentProps;

  const item = useMenuCheckboxItemContext();

  const indicatorRef = React.useRef<HTMLSpanElement | null>(null);

  const { transitionStatus, setMounted } = useTransitionStatus(item.checked);

  useOpenChangeComplete({
    open: item.checked,
    ref: indicatorRef,
    onComplete() {
      if (!item.checked) {
        setMounted(false);
      }
    },
  });

  const state: MenuCheckboxItemIndicatorState = {
    checked: item.checked,
    disabled: item.disabled,
    highlighted: item.highlighted,
    transitionStatus,
  };

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [forwardedRef, indicatorRef],
    stateAttributesMapping: itemMapping,
    props: {
      'aria-hidden': true,
      ...elementProps,
    },
    enabled: keepMounted || item.checked,
  });

  return element;
});

export interface MenuCheckboxItemIndicatorProps extends BaseUIComponentProps<
  'span',
  MenuCheckboxItemIndicatorState
> {
  /**
   * Whether to keep the HTML element in the DOM when the checkbox item is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface MenuCheckboxItemIndicatorState {
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace MenuCheckboxItemIndicator {
  export type Props = MenuCheckboxItemIndicatorProps;
  export type State = MenuCheckboxItemIndicatorState;
}
