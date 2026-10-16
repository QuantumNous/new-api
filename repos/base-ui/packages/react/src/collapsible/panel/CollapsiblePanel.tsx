'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { warn } from '@base-ui/utils/warn';
import { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';
import { collapsibleStateAttributesMapping } from '../root/stateAttributesMapping';
import { useCollapsiblePanel } from './useCollapsiblePanel';
import { CollapsiblePanelCssVars } from './CollapsiblePanelCssVars';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export const CollapsiblePanel = React.forwardRef(function CollapsiblePanel(
  componentProps: CollapsiblePanel.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    className,
    hiddenUntilFound: hiddenUntilFoundProp,
    keepMounted: keepMountedProp,
    render,
    id: idProp,
    style,
    ...elementProps
  } = componentProps;

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsoLayoutEffect(() => {
      if (hiddenUntilFoundProp && keepMountedProp === false) {
        warn(
          'The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
        );
      }
    }, [hiddenUntilFoundProp, keepMountedProp]);
  }

  const {
    mounted,
    onOpenChange,
    open,
    panelId,
    setMounted,
    setPanelIdState,
    setOpen,
    state,
    transitionStatus,
  } = useCollapsibleRootContext();

  const hiddenUntilFound = hiddenUntilFoundProp ?? false;
  const keepMounted = keepMountedProp ?? false;

  useIsoLayoutEffect(() => {
    if (idProp) {
      setPanelIdState(idProp);
      return () => {
        setPanelIdState(undefined);
      };
    }
    return undefined;
  }, [idProp, setPanelIdState]);

  const {
    height,
    props,
    ref,
    shouldPreventOpenAnimation,
    shouldRender,
    transitionStatus: panelTransitionStatus,
    width,
  } = useCollapsiblePanel({
    externalRef: forwardedRef,
    hiddenUntilFound,
    id: panelId,
    keepMounted,
    mounted,
    onOpenChange,
    open,
    setMounted,
    setOpen,
    transitionStatus,
  });

  const panelState: CollapsiblePanelState = {
    ...state,
    transitionStatus: panelTransitionStatus,
  };

  const resolvedStyle = resolveStyle(style, panelState);

  const element = useRenderElement(
    'div',
    {
      ...componentProps,
      style: undefined,
    },
    {
      state: panelState,
      ref,
      props: [
        props,
        {
          style: {
            [CollapsiblePanelCssVars.collapsiblePanelHeight as string]:
              height === undefined ? 'auto' : `${height}px`,
            [CollapsiblePanelCssVars.collapsiblePanelWidth as string]:
              width === undefined ? 'auto' : `${width}px`,
          },
        },
        elementProps,
        resolvedStyle ? { style: resolvedStyle } : undefined,
        // Resolve the public `style` prop so temporary `animationName: 'none'`
        // can still win after user's inline styles have been merged.
        shouldPreventOpenAnimation ? { style: { animationName: 'none' } } : undefined,
      ],
      stateAttributesMapping: collapsibleStateAttributesMapping,
    },
  );

  if (!shouldRender) {
    return null;
  }

  return element;
});

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsiblePanelProps extends BaseUIComponentProps<'div', CollapsiblePanelState> {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props = CollapsiblePanelProps;
}
