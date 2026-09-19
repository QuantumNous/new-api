'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useStore } from '@base-ui/utils/store';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { styleDisableScrollbar } from '../../utils/styles';
import { LIST_FUNCTIONAL_STYLES } from '../popup/utils';
import { selectors } from '../store';

/**
 * A container for the select items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectList = React.forwardRef(function SelectList(
  componentProps: SelectList.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const { store, scrollHandlerRef } = useSelectRootContext();
  const { alignItemWithTriggerActive } = useSelectPositionerContext();

  const hasScrollArrows = useStore(store, selectors.hasScrollArrows);
  const openMethod = useStore(store, selectors.openMethod);
  const multiple = useStore(store, selectors.multiple);
  const id = useStore(store, selectors.id);

  const defaultProps: HTMLProps = {
    id: `${id}-list`,
    role: 'listbox',
    'aria-multiselectable': multiple || undefined,
    onScroll(event) {
      scrollHandlerRef.current?.(event.currentTarget);
    },
    ...(alignItemWithTriggerActive && {
      style: LIST_FUNCTIONAL_STYLES,
    }),
    className:
      hasScrollArrows && openMethod !== 'touch' ? styleDisableScrollbar.className : undefined,
  };

  const setListElement = useStableCallback((element: HTMLElement | null) => {
    store.set('listElement', element);
  });

  return useRenderElement('div', componentProps, {
    ref: [forwardedRef, setListElement],
    props: [defaultProps, elementProps],
  });
});

export interface SelectListProps extends BaseUIComponentProps<'div', SelectListState> {}

export interface SelectListState {}

export namespace SelectList {
  export type Props = SelectListProps;
  export type State = SelectListState;
}
