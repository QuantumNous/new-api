'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPositionerContext } from './PreviewCardPositionerContext';
import { FloatingNode, useFloatingNodeId } from '../../floating-ui-react';
import {
  type Side,
  type Align,
  useAnchorPositioning,
  type UseAnchorPositioningSharedParameters,
} from '../../utils/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { usePreviewCardPortalContext } from '../portal/PreviewCardPortalContext';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { adaptiveOrigin } from '../../utils/adaptiveOriginMiddleware';
import { usePositioner } from '../../utils/usePositioner';
import { createInlineMiddleware } from '../../utils/popups';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export const PreviewCardPositioner = React.forwardRef(function PreviewCardPositioner(
  componentProps: PreviewCardPositioner.Props,
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
    collisionAvoidance = POPUP_COLLISION_AVOIDANCE,
    style,
    ...elementProps
  } = componentProps;

  const store = usePreviewCardRootContext();
  const keepMounted = usePreviewCardPortalContext();
  const nodeId = useFloatingNodeId();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const floatingRootContext = store.useState('floatingRootContext');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const hasViewport = store.useState('hasViewport');
  const inlineRectCoordsRef = store.context.inlineRectCoordsRef;

  const positioning = useAnchorPositioning({
    anchor,
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
    nodeId,
    collisionAvoidance,
    adaptiveOrigin: hasViewport ? adaptiveOrigin : undefined,
    inline: createInlineMiddleware(inlineRectCoordsRef),
  });
  const updatePosition = positioning.update;

  useIsoLayoutEffect(() => {
    if (open && mounted) {
      updatePosition();
    }
  }, [open, mounted, updatePosition]);

  const state: PreviewCardPositionerState = {
    open,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    instant: instantType,
  };

  const element = usePositioner(componentProps, state, {
    styles: positioning.positionerStyles,
    transitionStatus,
    props: elementProps,
    refs: [forwardedRef, store.useStateSetter('positionerElement')],
    hidden: !mounted,
    inert: !open,
  });

  return (
    <PreviewCardPositionerContext.Provider value={positioning}>
      <FloatingNode id={nodeId}>{element}</FloatingNode>
    </PreviewCardPositionerContext.Provider>
  );
});

export interface PreviewCardPositionerState {
  /**
   * Whether the preview card is currently open.
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
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PreviewCardPositionerProps
  extends
    UseAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', PreviewCardPositionerState> {}

export namespace PreviewCardPositioner {
  export type State = PreviewCardPositionerState;
  export type Props = PreviewCardPositionerProps;
}
