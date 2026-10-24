'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectItemContext } from '../item/SelectItemContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectItemText = React.memo(
  React.forwardRef(function SelectItemText(
    componentProps: SelectItemText.Props,
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) {
    const { index, textRef, selectedByFocus, hasRegistered } = useSelectItemContext();
    const { firstItemTextRef, selectedItemTextRef } = useSelectRootContext();

    const { render, className, style, ...elementProps } = componentProps;

    const localRef = React.useCallback(
      (node: HTMLElement | null) => {
        if (!node) {
          return;
        }

        if (hasRegistered && index === 0) {
          firstItemTextRef.current = node;
        }
        if (hasRegistered && selectedByFocus) {
          selectedItemTextRef.current = node;
        }
      },
      [firstItemTextRef, selectedItemTextRef, index, selectedByFocus, hasRegistered],
    );

    const element = useRenderElement('div', componentProps, {
      ref: [localRef, forwardedRef, textRef],
      props: elementProps,
    });

    return element;
  }),
);

export interface SelectItemTextState {}

export interface SelectItemTextProps extends BaseUIComponentProps<'div', SelectItemTextState> {}

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props = SelectItemTextProps;
}
