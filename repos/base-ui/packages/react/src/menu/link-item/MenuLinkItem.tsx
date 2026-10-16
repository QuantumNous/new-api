'use client';
import * as React from 'react';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuItemCommonProps } from '../item/useMenuItemCommonProps';
import { useButton } from '../../internals/use-button';
import { mergeProps } from '../../merge-props';

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export const MenuLinkItem = React.forwardRef(function MenuLinkItem(
  componentProps: MenuLinkItem.Props,
  forwardedRef: React.ForwardedRef<Element>,
) {
  const {
    render,
    className,
    id: idProp,
    label,
    closeOnClick = false,
    style,
    ...elementProps
  } = componentProps;

  const linkRef = React.useRef<HTMLAnchorElement | null>(null);

  const listItem = useCompositeListItem({ label });
  const menuPositionerContext = useMenuPositionerContext(true);
  const nodeId = menuPositionerContext?.context.nodeId;

  const id = useBaseUiId(idProp);

  const { store } = useMenuRootContext();
  const highlighted = store.useState('isActive', listItem.index);
  const itemProps = store.useState('itemProps');
  const typingRef = store.context.typingRef;

  const { getButtonProps, buttonRef } = useButton({
    native: false,
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    closeOnClick,
    highlighted,
    id,
    nodeId,
    store,
    typingRef,
    itemRef: linkRef,
  });

  function getItemProps(externalProps?: HTMLProps): HTMLProps {
    return mergeProps<'a'>(commonProps, externalProps, getButtonProps);
  }

  const state: MenuLinkItemState = { highlighted };

  return useRenderElement('a', componentProps, {
    state,
    props: [itemProps, elementProps, getItemProps],
    ref: [linkRef, buttonRef, forwardedRef, listItem.ref],
  });
});

export interface MenuLinkItemState {
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuLinkItemProps extends BaseUIComponentProps<'a', MenuLinkItemState> {
  /**
   * Overrides the text label to use when the item is matched during keyboard text navigation.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuLinkItem {
  export type State = MenuLinkItemState;
  export type Props = MenuLinkItemProps;
}
