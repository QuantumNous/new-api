'use client';
import * as React from 'react';
import { isElement } from '@floating-ui/utils/dom';
import { fastComponentRef } from '@base-ui/utils/fastHooks';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { BaseUIComponentProps, BaseUIEvent } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTriggerDataForwarding } from '../../utils/popups';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { TooltipHandle } from '../store/TooltipHandle';
import { useTooltipProviderContext } from '../provider/TooltipProviderContext';
import {
  safePolygon,
  useDelayGroup,
  useFocus,
  useHoverReferenceInteraction,
} from '../../floating-ui-react';
import { contains } from '../../floating-ui-react/utils/element';
import { isMouseLikePointerType } from '../../floating-ui-react/utils/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { TooltipTriggerDataAttributes } from './TooltipTriggerDataAttributes';
import { useHoverInteractionSharedState } from '../../floating-ui-react/hooks/useHoverInteractionSharedState';

import { OPEN_DELAY } from '../utils/constants';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-base-ui-tooltip-trigger';

function getTargetElement(event: Event): Element | null {
  if ('composedPath' in event) {
    const path = event.composedPath();
    for (let i = 0; i < path.length; i += 1) {
      const element = path[i];
      if (isElement(element)) {
        return element;
      }
    }
  }

  const target = event.target;
  if (isElement(target)) {
    return target;
  }

  return null;
}

function closestEnabledTooltipTrigger(element: Element | null): Element | null {
  let current = element;
  while (current) {
    if (current.hasAttribute(TOOLTIP_TRIGGER_IDENTIFIER)) {
      return current;
    }

    const parentElement = current.parentElement;
    if (parentElement) {
      current = parentElement;
      continue;
    }

    const root = current.getRootNode();
    current = 'host' in root && isElement(root.host) ? root.host : null;
  }

  return null;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export const TooltipTrigger = fastComponentRef(function TooltipTrigger(
  componentProps: TooltipTrigger.Props,
  forwardedRef: React.ForwardedRef<Element>,
) {
  const {
    render,
    className,
    style,
    handle,
    payload,
    disabled: disabledProp,
    delay,
    closeOnClick = true,
    closeDelay,
    id: idProp,
    ...elementProps
  } = componentProps;

  const rootContext = useTooltipRootContext(true);
  const store = handle?.store ?? rootContext;
  if (!store) {
    throw new Error(
      'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const floatingRootContext = store.useState('floatingRootContext');

  const triggerElementRef = React.useRef<Element | null>(null);

  const delayWithDefault = delay ?? OPEN_DELAY;
  const closeDelayWithDefault = closeDelay ?? 0;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      payload,
      closeOnClick,
      closeDelay: closeDelayWithDefault,
    },
  );

  const providerContext = useTooltipProviderContext();
  const { delayRef, isInstantPhase, hasProvider } = useDelayGroup(floatingRootContext, {
    open: isOpenedByThisTrigger,
  });
  const hoverInteraction = useHoverInteractionSharedState(floatingRootContext);

  store.useSyncedValue('isInstantPhase', isInstantPhase);

  const rootDisabled = store.useState('disabled');
  const disabled = disabledProp ?? rootDisabled;
  const disabledRef = useValueAsRef(disabled);
  const trackCursorAxis = store.useState('trackCursorAxis');
  const disableHoverablePopup = store.useState('disableHoverablePopup');

  const isNestedTriggerHoveredRef = React.useRef(false);
  const nestedTriggerOpenTimeout = useTimeout();
  // Local copy so it can be cleared on mouseLeave without resetting the hover hook's own pointerType.
  const pointerTypeRef = React.useRef<string | undefined>(undefined);

  function getOpenDelay() {
    const providerDelay = providerContext?.delay;
    const groupOpenValue = typeof delayRef.current === 'object' ? delayRef.current.open : undefined;

    let computedOpenDelay = delayWithDefault;
    if (hasProvider) {
      if (groupOpenValue !== 0) {
        computedOpenDelay = delay ?? providerDelay ?? delayWithDefault;
      } else {
        computedOpenDelay = 0;
      }
    }

    return computedOpenDelay;
  }

  function isEnabledNestedTriggerTarget(target: Element | null) {
    const triggerEl = triggerElementRef.current;
    if (!triggerEl || !target) {
      return false;
    }

    const nearestTrigger = closestEnabledTooltipTrigger(target);
    return (
      nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger)
    );
  }

  function detectNestedTriggerHover(target: Element | null) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

    isNestedTriggerHoveredRef.current = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      hoverInteraction.openChangeTimeout.clear();
      hoverInteraction.restTimeout.clear();
      hoverInteraction.restTimeoutPending = false;
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }

  const hoverProps = useHoverReferenceInteraction(floatingRootContext, {
    enabled: !disabled,
    mouseOnly: true,
    move: false,
    handleClose: !disableHoverablePopup && trackCursorAxis !== 'both' ? safePolygon() : null,
    restMs: getOpenDelay,
    delay() {
      const closeValue = typeof delayRef.current === 'object' ? delayRef.current.close : undefined;

      let computedCloseDelay: number | undefined = closeDelayWithDefault;
      if (closeDelay == null && hasProvider) {
        computedCloseDelay = closeValue;
      }

      return {
        close: computedCloseDelay,
      };
    },
    triggerElementRef,
    isActiveTrigger: isTriggerActive,
    isClosing: () => store.select('transitionStatus') === 'ending',
    shouldOpen() {
      return !isNestedTriggerHoveredRef.current;
    },
  });

  const focusProps = useFocus(floatingRootContext, { enabled: !disabled }).reference;

  const handleNestedTriggerHover = (event: MouseEvent) => {
    const wasNestedTriggerHovered = isNestedTriggerHoveredRef.current;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = triggerElementRef.current as HTMLElement | null;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);

    // Only close hover-opened parents. Focus/click-like opens remain owned by
    // their original interaction and should not be clobbered by nested hover.
    if (
      nestedTriggerHovered &&
      store.select('open') &&
      store.select('lastOpenChangeReason') === REASONS.triggerHover
    ) {
      store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !disabledRef.current &&
      !store.select('open') &&
      triggerEl &&
      // Match the hover hook's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerTypeRef.current)
    ) {
      const open = () => {
        if (!isNestedTriggerHoveredRef.current && !disabledRef.current && !store.select('open')) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerEl));
        }
      };

      const openDelay = getOpenDelay();

      // With `move: false`, the hover hook only listens to mouseenter/mouseleave
      // on the parent trigger. Leaving a nested child for the parent area fires
      // no event the hook can react to, so reopen locally.
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  };

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);
  const shouldApplyRootTriggerProps = isMountedByThisTrigger || trackCursorAxis !== 'none';

  const state: TooltipTriggerState = { open: isOpenedByThisTrigger };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: [forwardedRef, registerTrigger, triggerElementRef],
    props: [
      hoverProps,
      focusProps,
      shouldApplyRootTriggerProps ? rootTriggerProps : undefined,
      {
        onMouseOver(event: React.MouseEvent) {
          handleNestedTriggerHover(event.nativeEvent);
        },
        onFocus(event: React.FocusEvent) {
          if (isEnabledNestedTriggerTarget(getTargetElement(event.nativeEvent))) {
            (event as BaseUIEvent<React.FocusEvent<Element>>).preventBaseUIHandler();
          }
        },
        onMouseLeave() {
          isNestedTriggerHoveredRef.current = false;
          nestedTriggerOpenTimeout.clear();
          pointerTypeRef.current = undefined;
        },
        onPointerEnter(event: React.PointerEvent) {
          pointerTypeRef.current = event.pointerType;
        },
        onPointerDown(event: React.PointerEvent) {
          pointerTypeRef.current = event.pointerType;
          store.set('closeOnClick', closeOnClick);
          if (closeOnClick && !store.select('open')) {
            store.cancelPendingOpen(event.nativeEvent);
          }
        },
        onClick(event) {
          if (closeOnClick && !store.select('open')) {
            store.cancelPendingOpen(event.nativeEvent);
          }
        },
        id: thisTriggerId,
        [TooltipTriggerDataAttributes.triggerDisabled]: disabled ? '' : undefined,
        [TOOLTIP_TRIGGER_IDENTIFIER]: disabled ? undefined : '',
      } as React.HTMLAttributes<Element>,
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return element;
}) as TooltipTrigger;

export interface TooltipTrigger {
  <Payload>(
    componentProps: TooltipTrigger.Props<Payload> & React.RefAttributes<HTMLElement>,
  ): React.JSX.Element;
}

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'button',
  TooltipTriggerState
> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the trigger element via the `render` prop.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}
