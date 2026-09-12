'use client';
import * as React from 'react';
import { isElement } from '@floating-ui/utils/dom';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import {
  useAnchorPositioning,
  type Side,
  type Align,
  type UseAnchorPositioningSharedParameters,
} from '../../utils/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { ToastPositionerContext } from './ToastPositionerContext';
import { useFloatingRootContext } from '../../floating-ui-react';
import { NOOP } from '../../internals/noop';
import type { ToastObject } from '../useToastManager';
import { ToastRootCssVars } from '../root/ToastRootCssVars';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { usePositioner } from '../../utils/usePositioner';

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastPositioner = React.forwardRef(function ToastPositioner(
  componentProps: ToastPositioner.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { toast, ...props } = componentProps;

  const store = useToastProviderContext();

  const positionerProps = (toast.positionerProps ?? EMPTY_OBJECT) as NonNullable<
    typeof toast.positionerProps
  >;

  const {
    render,
    className,
    anchor: anchorProp = positionerProps.anchor,
    positionMethod = positionerProps.positionMethod ?? 'absolute',
    side = positionerProps.side ?? 'top',
    align = positionerProps.align ?? 'center',
    sideOffset = positionerProps.sideOffset ?? 0,
    alignOffset = positionerProps.alignOffset ?? 0,
    collisionBoundary = positionerProps.collisionBoundary ?? 'clipping-ancestors',
    collisionPadding = positionerProps.collisionPadding ?? 5,
    arrowPadding = positionerProps.arrowPadding ?? 5,
    sticky = positionerProps.sticky ?? false,
    disableAnchorTracking = positionerProps.disableAnchorTracking ?? false,
    collisionAvoidance = positionerProps.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
    style,
    ...elementProps
  } = props;

  const [positionerElement, setPositionerElement] = React.useState<HTMLDivElement | null>(null);

  const domIndex = store.useState('toastIndex', toast.id);
  const visibleIndex = store.useState('toastVisibleIndex', toast.id);

  const anchor = isElement(anchorProp) ? anchorProp : null;

  const floatingRootContext = useFloatingRootContext({
    open: true,
    onOpenChange: NOOP,
    elements: {
      floating: positionerElement,
      reference: anchor,
    },
  });

  const positioning = useAnchorPositioning({
    anchor,
    positionMethod,
    floatingRootContext,
    mounted: true,
    side,
    sideOffset,
    align,
    alignOffset,
    collisionBoundary,
    collisionPadding,
    sticky,
    arrowPadding,
    disableAnchorTracking,
    keepMounted: true,
    collisionAvoidance,
  });

  const state: ToastPositionerState = React.useMemo(
    () => ({
      side: positioning.side,
      align: positioning.align,
      anchorHidden: positioning.anchorHidden,
    }),
    [positioning.side, positioning.align, positioning.anchorHidden],
  );

  const element = usePositioner(componentProps, state, {
    styles: {
      ...positioning.positionerStyles,
      [ToastRootCssVars.index as string]:
        toast.transitionStatus === 'ending' ? domIndex : visibleIndex,
    },
    transitionStatus: toast.transitionStatus,
    props: elementProps,
    refs: [forwardedRef, setPositionerElement],
  });

  return (
    <ToastPositionerContext.Provider value={positioning}>{element}</ToastPositionerContext.Provider>
  );
});

export interface ToastPositionerState {
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
}

export interface ToastPositionerProps
  extends
    BaseUIComponentProps<'div', ToastPositionerState>,
    Omit<UseAnchorPositioningSharedParameters, 'side' | 'anchor'> {
  /**
   * An element to position the toast against.
   */
  anchor?: Element | null | undefined;
  /**
   * Which side of the anchor element to align the toast against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
  /**
   * The toast object associated with the positioner.
   */
  toast: ToastObject<any>;
}

export namespace ToastPositioner {
  export type State = ToastPositionerState;
  export type Props = ToastPositionerProps;
}
