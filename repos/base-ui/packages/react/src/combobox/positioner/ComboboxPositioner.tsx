'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { inertValue } from '@base-ui/utils/inertValue';
import {
  useComboboxFloatingContext,
  useComboboxRootContext,
  useComboboxDerivedItemsContext,
} from '../root/ComboboxRootContext';
import { ComboboxPositionerContext } from './ComboboxPositionerContext';
import {
  type Side,
  type Align,
  useAnchorPositioning,
  type UseAnchorPositioningSharedParameters,
} from '../../utils/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { useComboboxPortalContext } from '../portal/ComboboxPortalContext';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { selectors } from '../store';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import { usePositioner } from '../../utils/usePositioner';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxPositioner = React.forwardRef(function ComboboxPositioner(
  componentProps: ComboboxPositioner.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    anchor,
    positionMethod = 'absolute',
    side = 'bottom',
    align = 'center',
    sideOffset = 0,
    alignOffset = 0,
    collisionBoundary = 'clipping-ancestors',
    collisionPadding = 5,
    arrowPadding = 5,
    sticky = false,
    disableAnchorTracking = false,
    collisionAvoidance = DROPDOWN_COLLISION_AVOIDANCE,
    style: styleProp,
    ...elementProps
  } = componentProps;

  const store = useComboboxRootContext();
  const { filteredItems } = useComboboxDerivedItemsContext();
  const floatingRootContext = useComboboxFloatingContext();
  const keepMounted = useComboboxPortalContext();

  const modal = useStore(store, selectors.modal);
  const open = useStore(store, selectors.open);
  const mounted = useStore(store, selectors.mounted);
  const openMethod = useStore(store, selectors.openMethod);
  const positionerElement = useStore(store, selectors.positionerElement);
  const triggerElement = useStore(store, selectors.triggerElement);
  const inputElement = useStore(store, selectors.inputElement);
  const inputGroupElement = useStore(store, selectors.inputGroupElement);
  const inputInsidePopup = useStore(store, selectors.inputInsidePopup);
  const transitionStatus = useStore(store, selectors.transitionStatus);

  const empty = filteredItems.length === 0;
  const resolvedAnchor =
    anchor ?? (inputInsidePopup ? triggerElement : (inputGroupElement ?? inputElement));

  const positioning = useAnchorPositioning({
    anchor: resolvedAnchor,
    floatingRootContext,
    positionMethod,
    mounted,
    side,
    sideOffset,
    align,
    alignOffset,
    arrowPadding,
    collisionBoundary,
    collisionPadding,
    sticky,
    disableAnchorTracking,
    keepMounted,
    collisionAvoidance,
    lazyFlip: true,
  });

  useAnchoredPopupScrollLock(
    open && modal,
    openMethod === 'touch',
    positionerElement,
    triggerElement,
  );

  const state: ComboboxPositionerState = {
    open,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    empty,
  };

  useIsoLayoutEffect(() => {
    store.set('popupSide', positioning.side);
  }, [store, positioning.side]);

  const setPositionerElement = useStableCallback((element) => {
    store.set('positionerElement', element);
  });

  const element = usePositioner(componentProps, state, {
    styles: positioning.positionerStyles,
    transitionStatus,
    props: elementProps,
    refs: [forwardedRef, setPositionerElement],
    hidden: !mounted,
    inert: !open,
  });

  return (
    <ComboboxPositionerContext.Provider value={positioning}>
      {mounted && modal && (
        <InternalBackdrop
          inert={inertValue(!open)}
          cutout={inputGroupElement ?? inputElement ?? triggerElement}
        />
      )}
      {element}
    </ComboboxPositionerContext.Provider>
  );
});

export interface ComboboxPositionerState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPositionerProps
  extends
    UseAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', ComboboxPositionerState> {}

export namespace ComboboxPositioner {
  export type State = ComboboxPositionerState;
  export type Props = ComboboxPositionerProps;
}
