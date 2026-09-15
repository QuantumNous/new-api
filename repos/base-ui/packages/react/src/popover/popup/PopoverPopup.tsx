'use client';
import * as React from 'react';
import { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { FloatingFocusManager, useHoverFloatingInteraction } from '../../floating-ui-react';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import type { Side, Align } from '../../utils/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { REASONS } from '../../internals/reasons';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { ClosePartProvider, useClosePartCount } from '../../utils/closePart';
import { FOCUSABLE_POPUP_PROPS, createDefaultInitialFocus } from '../../utils/popups';

const stateAttributesMapping: StateAttributesMapping<PopoverPopupState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the popover contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export const PopoverPopup = React.forwardRef(function PopoverPopup(
  componentProps: PopoverPopup.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, initialFocus, finalFocus, ...elementProps } = componentProps;

  const { store } = usePopoverRootContext();

  const positioner = usePopoverPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;
  const { context: closePartContext, hasClosePart } = useClosePartCount();

  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const popupProps = store.useState('popupProps');
  const titleId = store.useState('titleElementId');
  const descriptionId = store.useState('descriptionElementId');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const openReason = store.useState('openChangeReason');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const floatingContext = store.useState('floatingRootContext');
  const floatingId = floatingContext.useState('floatingId');
  const disabled = store.useState('disabled');
  const openOnHover = store.useState('openOnHover');
  const closeDelay = store.useState('closeDelay');

  const popupId = elementProps.id ?? floatingId;

  useOpenChangeComplete({
    open,
    ref: store.context.popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  useHoverFloatingInteraction(floatingContext, { enabled: openOnHover && !disabled, closeDelay });

  const resolvedInitialFocus =
    initialFocus === undefined ? createDefaultInitialFocus(store.context.popupRef) : initialFocus;

  const focusManagerModal = modal !== false && hasClosePart;
  store.useSyncedValue('focusManagerModal', focusManagerModal);

  const setPopupElement = React.useCallback(
    (element: HTMLElement | null) => {
      store.set('popupElement', element);
    },
    [store],
  );

  const state: PopoverPopupState = {
    open,
    side: positioner.side,
    align: positioner.align,
    instant: instantType,
    transitionStatus,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
    props: [
      popupProps,
      {
        id: popupId,
        role: 'dialog',
        ...FOCUSABLE_POPUP_PROPS,
        'aria-labelledby': titleId,
        'aria-describedby': descriptionId,
        onKeyDown(event) {
          if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
      },
      getDisabledMountTransitionStyles(transitionStatus),
      elementProps,
    ],
    stateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      context={floatingContext}
      openInteractionType={openMethod}
      modal={focusManagerModal}
      disabled={!mounted || openReason === REASONS.triggerHover}
      initialFocus={resolvedInitialFocus}
      returnFocus={finalFocus}
      restoreFocus="popup"
      previousFocusableElement={
        isHTMLElement(activeTriggerElement) ? activeTriggerElement : undefined
      }
      nextFocusableElement={store.context.triggerFocusTargetRef}
      beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef}
    >
      <ClosePartProvider value={closePartContext}>{element}</ClosePartProvider>
    </FloatingFocusManager>
  );
});

export interface PopoverPopupState {
  /**
   * Whether the popover is currently open.
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
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;
}

export interface PopoverPopupProps extends BaseUIComponentProps<'div', PopoverPopupState> {
  /**
   * Determines the element to focus when the popover is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the popover
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | React.RefObject<HTMLElement | null>
    | ((openType: InteractionType) => void | boolean | HTMLElement | null)
    | undefined;
  /**
   * Determines the element to focus when the popover is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | React.RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => void | boolean | HTMLElement | null)
    | undefined;
}

export namespace PopoverPopup {
  export type State = PopoverPopupState;
  export type Props = PopoverPopupProps;
}
