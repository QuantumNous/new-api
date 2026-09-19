'use client';
import * as React from 'react';
import type { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { FloatingFocusManager, useHoverFloatingInteraction } from '../../floating-ui-react';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { Side, Align } from '../../utils/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';

const stateAttributesMapping: StateAttributesMapping<MenuPopupState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export const MenuPopup = React.forwardRef(function MenuPopup(
  componentProps: MenuPopup.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, finalFocus, ...elementProps } = componentProps;

  const { store } = useMenuRootContext();
  const { side, align } = useMenuPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;

  const open = store.useState('open');
  const transitionStatus = store.useState('transitionStatus');
  const popupProps = store.useState('popupProps');
  const mounted = store.useState('mounted');
  const instantType = store.useState('instantType');
  const triggerElement = store.useState('activeTriggerElement');
  const parent = store.useState('parent');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const rootId = store.useState('rootId');
  const floatingContext = store.useState('floatingRootContext');
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const closeDelay = store.useState('closeDelay');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const hoverEnabled = store.useState('hoverEnabled');
  const disabled = store.useState('disabled');
  const openMethod = store.useState('openMethod');

  const isContextMenu = parent.type === 'context-menu';

  useOpenChangeComplete({
    open,
    ref: store.context.popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  React.useEffect(() => {
    function handleClose(event: {
      domEvent: Event | undefined;
      reason: MenuRoot.ChangeEventReason;
    }) {
      store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
    }

    floatingTreeRoot.events.on('close', handleClose);

    return () => {
      floatingTreeRoot.events.off('close', handleClose);
    };
  }, [floatingTreeRoot.events, store]);

  useHoverFloatingInteraction(floatingContext, {
    enabled: hoverEnabled && !disabled && !isContextMenu && parent.type !== 'menubar',
    closeDelay,
  });

  const setPopupElement = React.useCallback(
    (element: HTMLElement | null) => {
      store.set('popupElement', element);
    },
    [store],
  );

  const state: MenuPopupState = {
    transitionStatus,
    side,
    align,
    open,
    nested: parent.type === 'menu',
    instant: instantType,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
    stateAttributesMapping,
    props: [
      popupProps,
      {
        onKeyDown(event) {
          if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
      },
      getDisabledMountTransitionStyles(transitionStatus),
      elementProps,
      { 'data-rootownerid': rootId } as Record<string, string>,
    ],
  });

  let returnFocus = parent.type === undefined || isContextMenu;
  if (
    triggerElement ||
    (parent.type === 'menubar' && lastOpenChangeReason !== REASONS.outsidePress)
  ) {
    returnFocus = true;
  }

  return (
    <FloatingFocusManager
      context={floatingContext}
      openInteractionType={openMethod}
      modal={isContextMenu}
      disabled={!mounted}
      returnFocus={finalFocus === undefined ? returnFocus : finalFocus}
      initialFocus={parent.type !== 'menu'}
      restoreFocus
      externalTree={parent.type !== 'menubar' ? floatingTreeRoot : undefined}
      previousFocusableElement={activeTriggerElement as HTMLElement | null}
      nextFocusableElement={
        parent.type === undefined ? store.context.triggerFocusTargetRef : undefined
      }
      beforeContentFocusGuardRef={
        parent.type === undefined ? store.context.beforeContentFocusGuardRef : undefined
      }
    >
      {element}
    </FloatingFocusManager>
  );
});

export interface MenuPopupProps extends BaseUIComponentProps<'div', MenuPopupState> {
  children?: React.ReactNode;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Determines the element to focus when the menu is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | React.RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface MenuPopupState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export namespace MenuPopup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}
