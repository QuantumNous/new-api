'use client';
import * as React from 'react';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { ownerDocument } from '@base-ui/utils/owner';
import { fastComponentRef } from '@base-ui/utils/fastHooks';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import {
  safePolygon,
  useClick,
  useFloatingTree,
  useFocus,
  useHoverReferenceInteraction,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../floating-ui-react';
import { FloatingTreeStore } from '../../floating-ui-react/components/FloatingTreeStore';
import { contains } from '../../floating-ui-react/utils';
import { useMenuRootContext } from '../root/MenuRootContext';
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { getPseudoElementBounds } from '../../utils/getPseudoElementBounds';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { findRootOwnerId } from '../utils/findRootOwnerId';
import { useTriggerDataForwarding } from '../../utils/popups';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { REASONS } from '../../internals/reasons';
import { useMixedToggleClickHandler } from '../../utils/useMixedToggleClickHandler';
import { MenuHandle } from '../store/MenuHandle';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { useMenubarContext } from '../../menubar/MenubarContext';
import { MenuParent } from '../root/MenuRoot';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { FocusGuard } from '../../utils/FocusGuard';
import { mergeProps } from '../../merge-props';

const BOUNDARY_OFFSET = 2;

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export const MenuTrigger = fastComponentRef(function MenuTrigger(
  componentProps: MenuTrigger.Props,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    render,
    className,
    style,
    disabled: disabledProp = false,
    nativeButton = true,
    id: idProp,
    openOnHover: openOnHoverProp,
    delay = 100,
    closeDelay = 0,
    handle,
    payload,
    ...elementProps
  } = componentProps;

  const rootContext = useMenuRootContext(true);
  const store = handle?.store ?? rootContext?.store;
  if (!store) {
    throw new Error(
      'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const floatingRootContext = store.useState('floatingRootContext');
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const triggerElementRef = React.useRef<HTMLElement | null>(null);

  const parent = useMenuParent();
  const compositeRootContext = useCompositeRootContext(true);
  const floatingTreeRootFromContext = useFloatingTree();
  const floatingTreeRoot: FloatingTreeStore = React.useMemo(() => {
    return floatingTreeRootFromContext ?? new FloatingTreeStore();
  }, [floatingTreeRootFromContext]);

  const floatingNodeId = useFloatingNodeId(floatingTreeRoot);
  const floatingParentNodeId = useFloatingParentNodeId();

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      payload,
      closeDelay,
      parent,
      floatingTreeRoot,
      floatingNodeId,
      floatingParentNodeId,
      keyboardEventRelay: compositeRootContext?.relayKeyboardEvent,
    },
  );

  const isInMenubar = parent.type === 'menubar';

  const rootDisabled = store.useState('disabled');
  const disabled = disabledProp || rootDisabled || (isInMenubar && parent.context.disabled);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  React.useEffect(() => {
    if (!isOpenedByThisTrigger && parent.type === undefined) {
      store.context.allowMouseUpTriggerRef.current = false;
    }
  }, [store, isOpenedByThisTrigger, parent.type]);

  const triggerRef = React.useRef<HTMLElement | null>(null);
  const allowMouseUpTriggerTimeout = useTimeout();

  const handleDocumentMouseUp = useStableCallback((mouseEvent: MouseEvent) => {
    if (!triggerRef.current) {
      return;
    }

    allowMouseUpTriggerTimeout.clear();
    store.context.allowMouseUpTriggerRef.current = false;

    const mouseUpTarget = mouseEvent.target as Element | null;

    if (
      contains(triggerRef.current, mouseUpTarget) ||
      contains(store.select('positionerElement'), mouseUpTarget) ||
      mouseUpTarget === triggerRef.current
    ) {
      return;
    }

    if (mouseUpTarget != null && findRootOwnerId(mouseUpTarget) === store.select('rootId')) {
      return;
    }

    const bounds = getPseudoElementBounds(triggerRef.current);

    if (
      mouseEvent.clientX >= bounds.left - BOUNDARY_OFFSET &&
      mouseEvent.clientX <= bounds.right + BOUNDARY_OFFSET &&
      mouseEvent.clientY >= bounds.top - BOUNDARY_OFFSET &&
      mouseEvent.clientY <= bounds.bottom + BOUNDARY_OFFSET
    ) {
      return;
    }

    floatingTreeRoot.events.emit('close', { domEvent: mouseEvent, reason: REASONS.cancelOpen });
  });

  React.useEffect(() => {
    if (isOpenedByThisTrigger && store.select('lastOpenChangeReason') === REASONS.triggerHover) {
      const doc = ownerDocument(triggerRef.current);
      doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
    }
  }, [isOpenedByThisTrigger, handleDocumentMouseUp, store]);

  const parentMenubarHasSubmenuOpen = isInMenubar && parent.context.hasSubmenuOpen;
  const openOnHover = openOnHoverProp ?? parentMenubarHasSubmenuOpen;

  const hoverProps = useHoverReferenceInteraction(floatingRootContext, {
    enabled:
      openOnHover &&
      !disabled &&
      parent.type !== 'context-menu' &&
      (!isInMenubar || (parentMenubarHasSubmenuOpen && !isMountedByThisTrigger)),
    handleClose: safePolygon({ blockPointerEvents: !isInMenubar }),
    mouseOnly: true,
    move: false,
    restMs: parent.type === undefined ? delay : undefined,
    delay: { close: closeDelay },
    triggerElementRef,
    externalTree: floatingTreeRoot,
    isActiveTrigger: isTriggerActive,
    isClosing: () => store.select('transitionStatus') === 'ending',
  });

  // Whether to ignore clicks to open the menu.
  // `lastOpenChangeReason` doesn't need to be reactive here, as we need to run this
  // only when `isOpenedByThisTrigger` changes.
  const stickIfOpen = useStickIfOpen(isOpenedByThisTrigger, store.select('lastOpenChangeReason'));

  const click = useClick(floatingRootContext, {
    enabled: !disabled && parent.type !== 'context-menu',
    event: isOpenedByThisTrigger && isInMenubar ? 'click' : 'mousedown',
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: parent.type === undefined ? stickIfOpen : false,
  });

  const focus = useFocus(floatingRootContext, {
    enabled: !disabled && parentMenubarHasSubmenuOpen,
  });

  const mixedToggleHandlers = useMixedToggleClickHandler({
    open: isOpenedByThisTrigger,
    enabled: isInMenubar,
    mouseDownAction: 'open',
  });

  const localInteractionProps = React.useMemo(
    () => mergeProps(focus.reference, click.reference),
    [focus.reference, click.reference],
  );

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);

  const { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus } =
    useTriggerFocusGuards(store, triggerElementRef);

  const state: MenuTriggerState = {
    disabled,
    open: isOpenedByThisTrigger,
  };

  const ref = [triggerRef, forwardedRef, buttonRef, registerTrigger, triggerElementRef];
  const props = [
    localInteractionProps,
    hoverProps ?? EMPTY_OBJECT,
    rootTriggerProps,
    {
      'aria-haspopup': 'menu' as const,
      'aria-controls': popupId,
      id: thisTriggerId,
      onMouseDown: (event: React.MouseEvent) => {
        if (store.select('open')) {
          return;
        }

        // mousedown -> mouseup on menu item should not trigger it within 200ms.
        allowMouseUpTriggerTimeout.start(200, () => {
          store.context.allowMouseUpTriggerRef.current = true;
        });

        const doc = ownerDocument(event.currentTarget);
        doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
      },
    },
    isInMenubar ? { role: 'menuitem' } : {},
    mixedToggleHandlers,
    elementProps,
    getButtonProps,
  ];

  const element = useRenderElement('button', componentProps, {
    enabled: !isInMenubar,
    stateAttributesMapping: pressableTriggerOpenStateMapping,
    state,
    ref,
    props,
  });

  if (isInMenubar) {
    return (
      <CompositeItem
        tag="button"
        render={render}
        className={className}
        style={style}
        state={state}
        refs={ref}
        props={props}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
      />
    );
  }

  // A fragment with key is required to ensure that the `element` is mounted to the same DOM node
  // regardless of whether the focus guards are rendered or not.

  if (isOpenedByThisTrigger) {
    return (
      <React.Fragment>
        <FocusGuard
          ref={preFocusGuardRef}
          onFocus={handlePreFocusGuardFocus}
          key={`${thisTriggerId}-pre-focus-guard`}
        />
        <React.Fragment key={thisTriggerId}>{element}</React.Fragment>
        <FocusGuard
          ref={store.context.triggerFocusTargetRef}
          onFocus={handleFocusTargetFocus}
          key={`${thisTriggerId}-post-focus-guard`}
        />
      </React.Fragment>
    );
  }

  return <React.Fragment key={thisTriggerId}>{element}</React.Fragment>;
}) as MenuTrigger;

export interface MenuTrigger {
  <Payload>(
    componentProps: MenuTriggerProps<Payload> & React.RefAttributes<HTMLElement>,
  ): React.JSX.Element;
}

export interface MenuTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', MenuTriggerState> {
  children?: React.ReactNode;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a menu.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A payload to pass to the menu when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   */
  openOnHover?: boolean | undefined;
}

export interface MenuTriggerState {
  /**
   * Whether the menu is currently open and was opened by this trigger.
   */
  open: boolean;
  /**
   * Whether the trigger is disabled.
   */
  disabled: boolean;
}

export namespace MenuTrigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}

/**
 * Determines whether to ignore clicks after a hover-open.
 */
function useStickIfOpen(open: boolean, openReason: string | null) {
  const stickIfOpenTimeout = useTimeout();
  const [stickIfOpen, setStickIfOpen] = React.useState(false);
  useIsoLayoutEffect(() => {
    if (open && openReason === 'trigger-hover') {
      // Only allow "patient" clicks to close the menu if it's open.
      // If they clicked within 500ms of the menu opening, keep it open.
      setStickIfOpen(true);
      stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        setStickIfOpen(false);
      });
    } else if (!open) {
      stickIfOpenTimeout.clear();
      setStickIfOpen(false);
    }
  }, [open, openReason, stickIfOpenTimeout]);

  return stickIfOpen;
}

function useMenuParent() {
  const contextMenuContext = useContextMenuRootContext(true);
  const parentContext = useMenuRootContext(true);
  const menubarContext = useMenubarContext(true);

  const parent: MenuParent = React.useMemo(() => {
    if (menubarContext) {
      return {
        type: 'menubar',
        context: menubarContext,
      };
    }

    // Ensure this is not a Menu nested inside ContextMenu.Trigger.
    // ContextMenu parentContext is always undefined as ContextMenu.Root is instantiated with
    // <MenuRootContext.Provider value={undefined}>
    if (contextMenuContext && !parentContext) {
      return {
        type: 'context-menu',
        context: contextMenuContext,
      };
    }

    return {
      type: undefined,
    };
  }, [contextMenuContext, parentContext, menubarContext]);

  return parent;
}
