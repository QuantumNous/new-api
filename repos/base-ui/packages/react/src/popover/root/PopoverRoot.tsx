'use client';
import * as React from 'react';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useDismiss, FloatingTree, useFloatingParentNodeId } from '../../floating-ui-react';
import { PopoverRootContext, usePopoverRootContext } from './PopoverRootContext';
import { PopoverStore } from '../store/PopoverStore';
import { PopoverHandle } from '../store/PopoverHandle';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  FOCUSABLE_POPUP_PROPS,
  useImplicitActiveTrigger,
  useInitialOpenSync,
  useOpenStateTransitions,
  usePopupInteractionProps,
  usePopupRootSync,
  type PayloadChildRenderFunction,
} from '../../utils/popups';
import { mergeProps } from '../../merge-props';

function PopoverRootComponent<Payload>({ props }: { props: PopoverRoot.Props<Payload> }) {
  const {
    children,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    onOpenChangeComplete,
    modal = false,
    handle,
    triggerId: triggerIdProp,
    defaultTriggerId: defaultTriggerIdProp = null,
  } = props;

  const store = PopoverStore.useStore(handle?.store, {
    modal,
    open: defaultOpen,
    openProp,
    activeTriggerId: defaultTriggerIdProp,
    triggerIdProp,
  });

  useInitialOpenSync(store, openProp, defaultOpen, defaultTriggerIdProp);

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as Payload | undefined;
  const nested = useFloatingParentNodeId() != null;

  store.useContextCallback('onOpenChange', onOpenChange);
  store.useContextCallback('onOpenChangeComplete', onOpenChangeComplete);

  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const { forceUnmount } = useOpenStateTransitions(open, store, () => {
    store.update({ stickIfOpen: true, openChangeReason: null });
  });

  store.useSyncedValues({
    modal,
    nested,
  });

  React.useEffect(() => {
    if (!open) {
      store.context.stickIfOpenTimeout.clear();
    }
  }, [store, open]);

  const handleImperativeClose = React.useCallback(() => {
    store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }, [store]);

  React.useImperativeHandle(
    props.actionsRef,
    () => ({ unmount: forceUnmount, close: handleImperativeClose }),
    [forceUnmount, handleImperativeClose],
  );

  const shouldRenderInteractions = open || mounted;

  const popoverContext: PopoverRootContext<Payload> = React.useMemo(
    () => ({
      store,
    }),
    [store],
  );

  return (
    <PopoverRootContext.Provider value={popoverContext as PopoverRootContext<unknown>}>
      {shouldRenderInteractions && <PopoverInteractions store={store} modal={modal} />}
      {typeof children === 'function' ? children({ payload }) : children}
    </PopoverRootContext.Provider>
  );
}

/**
 * Groups all parts of the popover.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverRoot<Payload = unknown>(props: PopoverRoot.Props<Payload>) {
  if (usePopoverRootContext(true)) {
    return <PopoverRootComponent props={props} />;
  }

  return (
    <FloatingTree>
      <PopoverRootComponent props={props} />
    </FloatingTree>
  );
}

export interface PopoverRootState {}

export interface PopoverRootProps<Payload = unknown> {
  /**
   * Whether the popover is initially open.
   *
   * To render a controlled popover, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popover is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popover is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: PopoverRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Event handler called after any animations complete when the popover is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the popover.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the popover imperatively when called.
   */
  actionsRef?: React.RefObject<PopoverRoot.Actions | null> | undefined;
  /**
   * Determines if the popover enters a modal state when open.
   * - `true`: user interaction is limited to the popover: document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
   * inside `<Popover.Popup>`. It can be visually hidden with your own CSS if needed, such as
   * Tailwind's `sr-only` utility.
   *
   * When `modal` is `'trap-focus'`, render `<Popover.Close>` inside `<Popover.Popup>` so touch
   * screen readers can escape the popup.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled popover.
   * There's no need to specify this prop when the popover is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open popover.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the popover with a trigger.
   * If specified, allows external triggers to control the popover's open state.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * The content of the popover.
   * This can be a regular React node or a render function that receives the `payload` of the active trigger.
   */
  children?: React.ReactNode | PayloadChildRenderFunction<Payload>;
}

export interface PopoverRootActions {
  unmount: () => void;
  close: () => void;
}

export type PopoverRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;
export type PopoverRootChangeEventDetails =
  BaseUIChangeEventDetails<PopoverRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace PopoverRoot {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

function PopoverInteractions({
  store,
  modal,
}: {
  store: PopoverStore<any>;
  modal: boolean | 'trap-focus';
}) {
  const floatingRootContext = store.useState('floatingRootContext');

  const dismiss = useDismiss(floatingRootContext, {
    outsidePressEvent: {
      // Ensure `aria-hidden` on outside elements is removed immediately
      // on outside press when trapping focus.
      mouse: modal === 'trap-focus' ? 'sloppy' : 'intentional',
      touch: 'sloppy',
    },
  });

  const activeTriggerProps = dismiss.reference ?? EMPTY_OBJECT;
  const inactiveTriggerProps = dismiss.trigger ?? EMPTY_OBJECT;
  const popupProps = React.useMemo(
    () => mergeProps(FOCUSABLE_POPUP_PROPS, dismiss.floating),
    [dismiss.floating],
  );

  usePopupInteractionProps(store, {
    activeTriggerProps,
    inactiveTriggerProps,
    popupProps,
  });

  return null;
}
