'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';
import { selectors } from '../store';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';

const stateAttributesMapping: StateAttributesMapping<SelectValueState> = {
  value: () => null,
};

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectValue = React.forwardRef(function SelectValue(
  componentProps: SelectValue.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const {
    className,
    render,
    children: childrenProp,
    placeholder,
    style,
    ...elementProps
  } = componentProps;

  const { store, valueRef } = useSelectRootContext();

  const value = useStore(store, selectors.value);
  const items = useStore(store, selectors.items);
  const itemToStringLabel = useStore(store, selectors.itemToStringLabel);
  const hasSelectedValue = useStore(store, selectors.hasSelectedValue);

  const shouldCheckNullItemLabel = !hasSelectedValue && placeholder != null && childrenProp == null;
  const hasNullLabel = useStore(store, selectors.hasNullItemLabel, shouldCheckNullItemLabel);

  const state: SelectValueState = {
    value,
    placeholder: !hasSelectedValue,
  };

  let children = null;
  if (typeof childrenProp === 'function') {
    children = childrenProp(value);
  } else if (childrenProp != null) {
    children = childrenProp;
  } else if (!hasSelectedValue && placeholder != null && !hasNullLabel) {
    children = placeholder;
  } else if (Array.isArray(value)) {
    children = resolveMultipleLabels(value, items, itemToStringLabel);
  } else {
    children = resolveSelectedLabel(value, items, itemToStringLabel);
  }

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [forwardedRef, valueRef],
    props: [{ children }, elementProps],
    stateAttributesMapping,
  });

  return element;
});

export interface SelectValueState {
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the placeholder is being displayed.
   */
  placeholder: boolean;
}

export interface SelectValueProps extends Omit<
  BaseUIComponentProps<'span', SelectValueState>,
  'children'
> {
  /**
   * Accepts a function that returns a `ReactNode` to format the selected value.
   * @example
   * ```tsx
   * <Select.Value>
   *   {(value: string | null) => value ? labels[value] : 'No value'}
   * </Select.Value>
   * ```
   */
  children?: React.ReactNode | ((value: any) => React.ReactNode);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: React.ReactNode;
}

export namespace SelectValue {
  export type State = SelectValueState;
  export type Props = SelectValueProps;
}
