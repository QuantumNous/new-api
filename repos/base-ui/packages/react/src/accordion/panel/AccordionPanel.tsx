'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { warn } from '@base-ui/utils/warn';
import { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import type { AccordionRoot } from '../root/AccordionRoot';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import { AccordionPanelCssVars } from './AccordionPanelCssVars';
import { useRenderElement } from '../../internals/useRenderElement';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export const AccordionPanel = React.forwardRef(function AccordionPanel(
  componentProps: AccordionPanel.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    className,
    hiddenUntilFound: hiddenUntilFoundProp,
    keepMounted: keepMountedProp,
    id: idProp,
    render,
    style,
    ...elementProps
  } = componentProps;

  const { hiddenUntilFound: contextHiddenUntilFound, keepMounted: contextKeepMounted } =
    useAccordionRootContext();

  const {
    mounted,
    onOpenChange,
    open,
    panelId,
    setMounted,
    setOpen,
    setPanelIdState,
    transitionStatus,
  } = useCollapsibleRootContext();

  const hiddenUntilFound = hiddenUntilFoundProp ?? contextHiddenUntilFound;
  const keepMounted = keepMountedProp ?? contextKeepMounted;

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsoLayoutEffect(() => {
      if (keepMountedProp === false && hiddenUntilFound) {
        warn(
          'The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
        );
      }
    }, [hiddenUntilFound, keepMountedProp]);
  }

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
    id: idProp ?? panelId,
    keepMounted,
    mounted,
    onOpenChange,
    open,
    setMounted,
    setOpen,
    transitionStatus,
  });

  const { state, triggerId } = useAccordionItemContext();

  const panelState: AccordionPanelState = {
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
          'aria-labelledby': triggerId,
          role: 'region',
          style: {
            [AccordionPanelCssVars.accordionPanelHeight as string]:
              height === undefined ? 'auto' : `${height}px`,
            [AccordionPanelCssVars.accordionPanelWidth as string]:
              width === undefined ? 'auto' : `${width}px`,
          },
        },
        elementProps,
        resolvedStyle ? { style: resolvedStyle } : undefined,
        // Resolve the public `style` prop so temporary `animationName: 'none'`
        // can still win after user's inline styles have been merged.
        shouldPreventOpenAnimation ? { style: { animationName: 'none' } } : undefined,
      ],
      stateAttributesMapping: accordionStateAttributesMapping,
    },
  );

  if (!shouldRender) {
    return null;
  }

  return element;
});

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AccordionPanelProps
  extends
    BaseUIComponentProps<'div', AccordionPanelState>,
    Pick<AccordionRoot.Props, 'hiddenUntilFound' | 'keepMounted'> {}

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props = AccordionPanelProps;
}
