'use client';
import * as React from 'react';
import { error } from '@base-ui/utils/error';
import { SafeReact } from '@base-ui/utils/safeReact';
import type { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { FloatingFocusManager } from '../../floating-ui-react';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { DrawerBackdropCssVars } from '../backdrop/DrawerBackdropCssVars';
import { DrawerPopupCssVars } from './DrawerPopupCssVars';
import { DrawerPopupDataAttributes } from './DrawerPopupDataAttributes';
import { useDialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups';

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: '0',
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: '1',
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<number>',
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopupState> = {
  ...baseMapping,
  ...transitionStatusMapping,
  expanded(value) {
    return value ? { [DrawerPopupDataAttributes.expanded]: '' } : null;
  },
  nestedDrawerOpen(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerOpen]: '' } : null;
  },
  nestedDrawerSwiping(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerSwiping]: '' } : null;
  },
  swipeDirection(value) {
    return value ? { [DrawerPopupDataAttributes.swipeDirection]: value } : null;
  },
  swiping(value) {
    return value ? { [DrawerPopupDataAttributes.swiping]: '' } : null;
  },
};

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export const DrawerPopup = React.forwardRef(function DrawerPopup(
  componentProps: DrawerPopup.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, finalFocus, initialFocus, ...elementProps } = componentProps;

  const { store } = useDialogRootContext();
  const popupRef = store.context.popupRef;

  const {
    swipeDirection,
    frontmostHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgressStore,
    onPopupHeightChange,
    notifyParentFrontmostHeight,
    notifyParentHasNestedDrawer,
  } = useDrawerRootContext();

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const floatingRootContext = store.useState('floatingRootContext');
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDrawerCount = store.useState('nestedOpenDrawerCount');
  const transitionStatus = store.useState('transitionStatus');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const role = store.useState('role');
  const floatingId = floatingRootContext.useState('floatingId');

  const popupId = elementProps.id ?? floatingId;

  const swipe = useDrawerViewportContext(true);
  useDialogPortalContext();
  const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints();

  const nestedDrawerOpen = nestedOpenDrawerCount > 0;
  const swiping = swipe?.swiping ?? false;
  const swipeStrength = swipe?.swipeStrength ?? null;

  const [popupHeight, setPopupHeight] = React.useState(0);
  const popupHeightRef = React.useRef(0);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      if (swipe) {
        return;
      }

      const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
      const message =
        '<Drawer.Popup> expected to be rendered within <Drawer.Viewport>. Omitting the ' +
        'viewport disables drawer swipe handling and touch scroll locking. Wrap ' +
        '<Drawer.Popup> in <Drawer.Viewport>.';
      error(`${message}${ownerStackMessage}`);
    }, [swipe]);
  }

  const measureHeight = useStableCallback(() => {
    const popupElement = popupRef.current;
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (
      popupHeightRef.current > 0 &&
      frontmostHeight > popupHeightRef.current &&
      offsetHeight > popupHeightRef.current
    ) {
      return;
    }

    const keepHeightWhileNested = popupHeightRef.current > 0 && hasNestedDrawer;
    if (keepHeightWhileNested) {
      const oldHeight = popupHeightRef.current;
      setPopupHeight(oldHeight);
      onPopupHeightChange(oldHeight);
      return;
    }

    const nextHeight = offsetHeight;
    if (nextHeight === popupHeightRef.current) {
      return;
    }

    popupHeightRef.current = nextHeight;
    setPopupHeight(nextHeight);
    onPopupHeightChange(nextHeight);
  });

  useIsoLayoutEffect(() => {
    if (!mounted) {
      popupHeightRef.current = 0;
      setPopupHeight(0);
      onPopupHeightChange(0);
      return undefined;
    }

    const popupElement = popupRef.current;
    if (!popupElement) {
      return undefined;
    }

    removeCSSVariableInheritance();
    measureHeight();

    if (typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(measureHeight);

    resizeObserver.observe(popupElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [measureHeight, mounted, nestedDrawerOpen, onPopupHeightChange, popupRef]);

  useIsoLayoutEffect(() => {
    const syncNestedSwipeProgress = () => {
      const popupElement = popupRef.current;
      if (!popupElement) {
        return;
      }

      const progress = nestedSwipeProgressStore.getSnapshot();
      if (progress > 0) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
      } else {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    };

    syncNestedSwipeProgress();
    const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);
    const popupElement = popupRef.current;

    return () => {
      unsubscribe();
      if (popupElement) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    };
  }, [nestedSwipeProgressStore, popupRef]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    notifyParentFrontmostHeight?.(frontmostHeight);

    return () => {
      notifyParentFrontmostHeight?.(0);
    };
  }, [frontmostHeight, open, notifyParentFrontmostHeight]);

  React.useEffect(() => {
    if (!notifyParentHasNestedDrawer) {
      return undefined;
    }

    const present = open || transitionStatus === 'ending';
    notifyParentHasNestedDrawer(present);

    return () => {
      notifyParentHasNestedDrawer(false);
    };
  }, [notifyParentHasNestedDrawer, open, transitionStatus]);

  useOpenChangeComplete({
    open,
    ref: popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus = initialFocus === undefined ? popupRef : initialFocus;

  const setPopupElement = store.useStateSetter('popupElement');

  const state: DrawerPopupState = {
    open,
    nested,
    transitionStatus,
    expanded: activeSnapPoint === 1,
    nestedDrawerOpen,
    nestedDrawerSwiping: nestedSwiping,
    swipeDirection,
    swiping,
  };

  let popupHeightCssVarValue: string | undefined;
  const shouldUseAutoHeight = !hasNestedDrawer && transitionStatus !== 'ending';
  if (popupHeight && !shouldUseAutoHeight) {
    popupHeightCssVarValue = `${popupHeight}px`;
  }

  const shouldApplySnapPoints =
    snapPoints && snapPoints.length > 0 && (swipeDirection === 'down' || swipeDirection === 'up');
  let snapPointOffsetValue: number | null = null;
  if (shouldApplySnapPoints && activeSnapPointOffset !== null) {
    snapPointOffsetValue = swipeDirection === 'up' ? -activeSnapPointOffset : activeSnapPointOffset;
  }

  let dragStyles = swipe ? swipe.getDragStyles() : EMPTY_OBJECT;
  if (shouldApplySnapPoints && swipeDirection === 'down') {
    const baseOffset = activeSnapPointOffset ?? 0;
    const movementValue = Number.parseFloat(
      String((dragStyles as Record<string, string>)[DrawerPopupCssVars.swipeMovementY] ?? 0),
    );

    if (swiping && Number.isFinite(movementValue)) {
      dragStyles = {
        ...dragStyles,
        transform: undefined,
        [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(
          baseOffset,
          movementValue,
        )}px`,
      } as React.CSSProperties;
    } else {
      dragStyles = {
        ...dragStyles,
        transform: undefined,
      };
    }
  }

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      rootPopupProps,
      {
        id: popupId,
        'aria-labelledby': titleElementId,
        'aria-describedby': descriptionElementId,
        role,
        ...FOCUSABLE_POPUP_PROPS,
        hidden: !mounted,
        onKeyDown(event: React.KeyboardEvent) {
          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        style: {
          ...dragStyles,
          [DrawerBackdropCssVars.swipeProgress]: '0',
          [DrawerPopupCssVars.nestedDrawers]: nestedOpenDrawerCount,
          [DrawerPopupCssVars.height]: popupHeightCssVarValue,
          [DrawerPopupCssVars.snapPointOffset]:
            typeof snapPointOffsetValue === 'number' ? `${snapPointOffsetValue}px` : '0px',
          [DrawerPopupCssVars.frontmostHeight]: frontmostHeight
            ? `${frontmostHeight}px`
            : undefined,
          [DrawerPopupCssVars.swipeStrength]:
            typeof swipeStrength === 'number' && Number.isFinite(swipeStrength) && swipeStrength > 0
              ? `${swipeStrength}`
              : '1',
        } as React.CSSProperties,
      },
      elementProps,
    ],
    ref: [forwardedRef, popupRef, setPopupElement],
    stateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      openInteractionType={openMethod}
      disabled={!mounted}
      closeOnFocusOut={!disablePointerDismissal}
      initialFocus={resolvedInitialFocus}
      returnFocus={finalFocus}
      modal={modal !== false}
      restoreFocus="popup"
    >
      {element}
    </FloatingFocusManager>
  );
});

export interface DrawerPopupProps extends BaseUIComponentProps<'div', DrawerPopupState> {
  /**
   * Determines the element to focus when the drawer is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | React.RefObject<HTMLElement | null>
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the drawer is closed.
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

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer is nested within a parent drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

export namespace DrawerPopup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}
