'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useId } from '@base-ui/utils/useId';
import { inertValue } from '@base-ui/utils/inertValue';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { FocusGuard } from '../../utils/FocusGuard';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
  contains,
} from '../../floating-ui-react/utils';
import { getEmptyRootContext } from '../../floating-ui-react/utils/getEmptyRootContext';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';

const EMPTY_ROOT_CONTEXT = getEmptyRootContext();

function Guards({ children }: { children: React.ReactNode }) {
  const {
    beforeInsideRef,
    beforeOutsideRef,
    afterInsideRef,
    afterOutsideRef,
    positionerElement,
    viewportElement,
    floatingRootContext,
  } = useNavigationMenuRootContext();
  const hasPositioner = Boolean(useNavigationMenuPositionerContext(true));

  const referenceElement = positionerElement || viewportElement;

  if (!floatingRootContext && !hasPositioner) {
    return children;
  }

  return (
    <React.Fragment>
      <FocusGuard
        ref={beforeInsideRef}
        onFocus={(event) => {
          if (referenceElement && isOutsideEvent(event, referenceElement)) {
            getNextTabbable(referenceElement)?.focus();
          } else {
            beforeOutsideRef.current?.focus();
          }
        }}
      />
      {children}
      <FocusGuard
        ref={afterInsideRef}
        onFocus={(event) => {
          if (referenceElement && isOutsideEvent(event, referenceElement)) {
            getPreviousTabbable(referenceElement)?.focus();
          } else {
            afterOutsideRef.current?.focus();
          }
        }}
      />
    </React.Fragment>
  );
}

/**
 * The clipping viewport of the navigation menu's current content.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuViewport = React.forwardRef(function NavigationMenuViewport(
  componentProps: NavigationMenuViewport.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, children, id: idProp, ...elementProps } = componentProps;

  const id = useId(idProp);

  const {
    setViewportElement,
    setViewportTargetElement,
    floatingRootContext,
    prevTriggerElementRef,
    viewportInert,
    setViewportInert,
  } = useNavigationMenuRootContext();

  const positioning = useNavigationMenuPositionerContext(true);
  const hasPositioner = Boolean(positioning);
  const domReference = (floatingRootContext || EMPTY_ROOT_CONTEXT).useState('domReferenceElement');

  useIsoLayoutEffect(() => {
    if (domReference) {
      prevTriggerElementRef.current = domReference;
    }
  }, [domReference, prevTriggerElementRef]);

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, setViewportElement],
    props: [
      {
        id,
        onBlur(event) {
          const relatedTarget = event.relatedTarget as Element | null;
          const currentTarget = event.currentTarget as Element;

          // If focus is leaving the viewport and not going to the trigger, make it inert
          // to prevent a focus loop.
          if (
            relatedTarget &&
            !contains(currentTarget, relatedTarget) &&
            relatedTarget !== domReference
          ) {
            setViewportInert(true);
          }
        },
        ...(!hasPositioner && viewportInert && { inert: inertValue(true) }),
        children: hasPositioner ? (
          children
        ) : (
          <Guards>
            <div ref={setViewportTargetElement}>{children}</div>
          </Guards>
        ),
      },
      elementProps,
    ],
  });

  return hasPositioner ? <Guards>{element}</Guards> : element;
});

export interface NavigationMenuViewportState {}

export interface NavigationMenuViewportProps extends BaseUIComponentProps<
  'div',
  NavigationMenuViewportState
> {}

export namespace NavigationMenuViewport {
  export type State = NavigationMenuViewportState;
  export type Props = NavigationMenuViewportProps;
}
