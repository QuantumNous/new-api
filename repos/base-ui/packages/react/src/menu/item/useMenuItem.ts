'use client';
import * as React from 'react';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { useButton } from '../../internals/use-button';
import { mergeProps } from '../../merge-props';
import { HTMLProps } from '../../internals/types';
import { MenuStore } from '../store/MenuStore';
import { useMenuItemCommonProps } from './useMenuItemCommonProps';

export const REGULAR_ITEM = {
  type: 'regular-item' as const,
};

export function useMenuItem(params: UseMenuItemParameters): UseMenuItemReturnValue {
  const {
    closeOnClick,
    disabled: disabledProp = false,
    highlighted,
    id,
    store,
    typingRef = store.context.typingRef,
    nativeButton,
    itemMetadata,
    nodeId,
  } = params;

  const rootDisabled = store.useState('disabled');
  const disabled = disabledProp || rootDisabled;

  const itemRef = React.useRef<HTMLElement | null>(null);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    closeOnClick,
    highlighted,
    id,
    nodeId,
    store,
    typingRef,
    itemRef,
    itemMetadata,
  });

  const getItemProps = React.useCallback(
    (externalProps?: HTMLProps): HTMLProps => {
      return mergeProps<'div'>(
        commonProps,
        {
          onMouseEnter() {
            if (itemMetadata.type !== 'submenu-trigger') {
              return;
            }

            itemMetadata.setActive();
          },
        },
        externalProps,
        getButtonProps,
      );
    },
    [commonProps, getButtonProps, itemMetadata],
  );

  const mergedRef = useMergedRefs(itemRef, buttonRef);

  return React.useMemo(
    () => ({
      getItemProps,
      itemRef: mergedRef,
    }),
    [getItemProps, mergedRef],
  );
}

export interface UseMenuItemParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: boolean;
  /**
   * The id of the menu item.
   */
  id: string | undefined;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default false
   */
  nativeButton: boolean;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: UseMenuItemMetadata;
  /**
   * The node id of the menu positioner.
   */
  nodeId: string | undefined;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   * @default store.context.typingRef
   */
  typingRef?: React.RefObject<boolean> | undefined;
}

export type UseMenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: 'submenu-trigger';
      setActive: () => void;
    };

export interface UseMenuItemReturnValue {
  /**
   * Resolver for the root slot's props.
   * @param externalProps event handlers for the root slot
   * @returns props that should be spread on the root slot
   */
  getItemProps: (externalProps?: HTMLProps) => HTMLProps;
  /**
   * The ref to the component's root DOM element.
   */
  itemRef: React.RefCallback<HTMLElement> | null;
}

export interface UseMenuItemState {}
