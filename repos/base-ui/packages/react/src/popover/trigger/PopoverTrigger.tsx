'use client';
import * as React from 'react';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useButton } from '../../internals/use-button/useButton';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import {
  triggerOpenStateMapping,
  pressableTriggerOpenStateMapping,
} from '../../utils/popupStateMapping';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import { safePolygon, useClick, useHoverReferenceInteraction } from '../../floating-ui-react';
import { OPEN_DELAY } from '../utils/constants';
import { PopoverHandle } from '../store/PopoverHandle';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { FocusGuard } from '../../utils/FocusGuard';
import { REASONS } from '../../internals/reasons';
import { useTriggerDataForwarding } from '../../utils/popups';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import { useOpenMethodTriggerProps } from '../../utils/useOpenInteractionType';

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export const PopoverTrigger = React.forwardRef(function PopoverTrigger(
  componentProps: PopoverTrigger.Props,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    render,
    className,
    style,
    disabled = false,
    nativeButton = true,
    handle,
    payload,
    openOnHover = false,
    delay = OPEN_DELAY,
    closeDelay = 0,
    id: idProp,
    ...elementProps
  } = componentProps;

  const rootContext = usePopoverRootContext(true);
  const store = handle?.store ?? rootContext?.store;
  if (!store) {
    throw new Error(
      'Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const floatingContext = store.useState('floatingRootContext');
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const triggerElementRef = React.useRef<HTMLElement | null>(null);

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      payload,
      disabled,
      openOnHover,
      closeDelay,
    },
  );

  const openReason = store.useState('openChangeReason');
  const stickIfOpen = store.useState('stickIfOpen');
  const openMethod = store.useState('openMethod');
  const focusManagerModal = store.useState('focusManagerModal');

  const hoverProps = useHoverReferenceInteraction(floatingContext, {
    enabled:
      !disabled &&
      floatingContext != null &&
      openOnHover &&
      (openMethod !== 'touch' || openReason !== REASONS.triggerPress),
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
    restMs: delay,
    delay: {
      close: closeDelay,
    },
    triggerElementRef,
    isActiveTrigger: isTriggerActive,
    isClosing: () => store.select('transitionStatus') === 'ending',
  });

  const click = useClick(floatingContext, { enabled: floatingContext != null, stickIfOpen });
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => store.select('open'),
    (interactionType) => {
      store.set('openMethod', interactionType);
    },
  );

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const stateAttributesMapping: StateAttributesMapping<{ open: boolean }> = {
    open(value) {
      if (value && openReason === REASONS.triggerPress) {
        return pressableTriggerOpenStateMapping.open(value);
      }

      return triggerOpenStateMapping.open(value);
    },
  };

  const { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus } =
    useTriggerFocusGuards(store, triggerElementRef);

  const state: PopoverTriggerState = {
    disabled,
    open: isOpenedByThisTrigger,
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: [buttonRef, forwardedRef, registerTrigger, triggerElementRef],
    props: [
      click.reference,
      hoverProps,
      rootTriggerProps,
      interactionTypeProps,
      {
        [CLICK_TRIGGER_IDENTIFIER as string]: '',
        id: thisTriggerId,
        'aria-haspopup': 'dialog' as const,
        'aria-expanded': isOpenedByThisTrigger,
        'aria-controls': popupId,
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });

  // A fragment with key is required to ensure that the `element` is mounted to the same DOM node
  // regardless of whether the focus guards are rendered or not.

  if (isMountedByThisTrigger && !focusManagerModal) {
    return (
      <React.Fragment>
        <FocusGuard ref={preFocusGuardRef} onFocus={handlePreFocusGuardFocus} />
        <React.Fragment key={thisTriggerId}>{element}</React.Fragment>
        <FocusGuard ref={store.context.triggerFocusTargetRef} onFocus={handleFocusTargetFocus} />
      </React.Fragment>
    );
  }

  return <React.Fragment key={thisTriggerId}>{element}</React.Fragment>;
}) as PopoverTrigger;

export interface PopoverTrigger {
  <Payload>(
    componentProps: PopoverTriggerProps<Payload> & React.RefAttributes<HTMLElement>,
  ): React.JSX.Element;
}

export interface PopoverTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the popover is currently open and was opened by this trigger.
   */
  open: boolean;
}

export type PopoverTriggerProps<Payload = unknown> = NativeButtonProps &
  BaseUIComponentProps<'button', PopoverTriggerState> & {
    /**
     * Whether the component renders a native `<button>` element when replacing it
     * via the `render` prop.
     * Set to `false` if the rendered element is not a button (e.g. `<div>`).
     * @default true
     */
    nativeButton?: boolean | undefined;
    /**
     * A handle to associate the trigger with a popover.
     */
    handle?: PopoverHandle<Payload> | undefined;
    /**
     * A payload to pass to the popover when it is opened.
     */
    payload?: Payload | undefined;
    /**
     * ID of the trigger. In addition to being forwarded to the rendered element,
     * it is also used to specify the active trigger for the popover in controlled mode (with the PopoverRoot `triggerId` prop).
     */
    id?: string | undefined;
    /**
     * Whether the popover should also open when the trigger is hovered.
     * @default false
     */
    openOnHover?: boolean | undefined;
    /**
     * How long to wait before the popover may be opened on hover. Specified in milliseconds.
     *
     * Requires the `openOnHover` prop.
     * @default 300
     */
    delay?: number | undefined;
    /**
     * How long to wait before closing the popover that was opened on hover.
     * Specified in milliseconds.
     *
     * Requires the `openOnHover` prop.
     * @default 0
     */
    closeDelay?: number | undefined;
  };

export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}
