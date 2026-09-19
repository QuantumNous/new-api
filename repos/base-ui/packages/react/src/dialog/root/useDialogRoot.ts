'use client';
import * as React from 'react';
import { useScrollLock } from '@base-ui/utils/useScrollLock';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useDismiss } from '../../floating-ui-react';
import { contains, getTarget } from '../../floating-ui-react/utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { type DialogRoot } from './DialogRoot';
import { DialogStore } from '../store/DialogStore';
import {
  useImplicitActiveTrigger,
  useOpenStateTransitions,
  usePopupInteractionProps,
  usePopupRootSync,
} from '../../utils/popups';

export function useDialogRoot(params: UseDialogRootParameters): void {
  const { store, actionsRef } = params;

  const open = store.useState('open');
  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const { forceUnmount } = useOpenStateTransitions(open, store);

  const handleImperativeClose = React.useCallback(() => {
    store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }, [store]);

  React.useImperativeHandle(
    actionsRef,
    () => ({ unmount: forceUnmount, close: handleImperativeClose }),
    [forceUnmount, handleImperativeClose],
  );
}

export interface UseDialogRootParameters {
  store: DialogStore<any>;
  actionsRef?: DialogRoot.Props['actionsRef'] | undefined;
}

export function DialogInteractions({
  store,
  parentContext,
  isDrawer,
}: {
  store: DialogStore<any>;
  parentContext: DialogStore<unknown>['context'] | undefined;
  isDrawer: boolean;
}) {
  const open = store.useState('open');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const modal = store.useState('modal');
  const popupElement = store.useState('popupElement');
  const floatingRootContext = store.useState('floatingRootContext');

  const [ownNestedOpenDialogs, setOwnNestedOpenDialogs] = React.useState(0);
  const [ownNestedOpenDrawers, setOwnNestedOpenDrawers] = React.useState(0);
  const isTopmost = ownNestedOpenDialogs === 0;

  const dismiss = useDismiss(floatingRootContext, {
    outsidePressEvent() {
      if (store.context.internalBackdropRef.current || store.context.backdropRef.current) {
        return 'intentional';
      }
      // Ensure `aria-hidden` on outside elements is removed immediately
      // on outside press when trapping focus.
      return {
        mouse: modal === 'trap-focus' ? 'sloppy' : 'intentional',
        touch: 'sloppy',
      };
    },
    outsidePress(event) {
      if (!store.context.outsidePressEnabledRef.current) {
        return false;
      }

      // For mouse events, only accept left button (button 0)
      // For touch events, a single touch is equivalent to left button
      if ('button' in event && event.button !== 0) {
        return false;
      }
      if ('touches' in event && event.touches.length !== 1) {
        return false;
      }

      const target = getTarget(event) as Element | null;
      if (isTopmost && !disablePointerDismissal) {
        // Only close if the click occurred on the dialog's owning backdrop.
        // This supports multiple modal dialogs that aren't nested in the React tree:
        // https://github.com/mui/base-ui/issues/1320
        if (modal) {
          return store.context.internalBackdropRef.current || store.context.backdropRef.current
            ? store.context.internalBackdropRef.current === target ||
                store.context.backdropRef.current === target ||
                (contains(target, popupElement) && !target?.hasAttribute('data-base-ui-portal'))
            : true;
        }
        return true;
      }
      return false;
    },
    escapeKey: isTopmost,
  });

  useScrollLock(open && modal === true, popupElement);

  // Listen for nested open/close events on this store to maintain the counts.
  store.useContextCallback('onNestedDialogOpen', (dialogCount, drawerCount) => {
    setOwnNestedOpenDialogs(dialogCount);
    setOwnNestedOpenDrawers(drawerCount);
  });

  store.useContextCallback('onNestedDialogClose', () => {
    setOwnNestedOpenDialogs(0);
    setOwnNestedOpenDrawers(0);
  });

  // Notify parent of our open/close state using parent callbacks, if any
  React.useEffect(() => {
    if (parentContext?.onNestedDialogOpen && open) {
      parentContext.onNestedDialogOpen(
        ownNestedOpenDialogs + 1,
        ownNestedOpenDrawers + (isDrawer ? 1 : 0),
      );
    }
    if (parentContext?.onNestedDialogClose && !open) {
      parentContext.onNestedDialogClose();
    }
    return () => {
      if (parentContext?.onNestedDialogClose && open) {
        parentContext.onNestedDialogClose();
      }
    };
  }, [isDrawer, open, ownNestedOpenDialogs, ownNestedOpenDrawers, parentContext]);

  const activeTriggerProps = dismiss.reference ?? EMPTY_OBJECT;
  const inactiveTriggerProps = dismiss.trigger ?? EMPTY_OBJECT;
  // Consumers (DialogPopup/DrawerPopup) already spread `FOCUSABLE_POPUP_PROPS`
  // directly, so the popup props only need to carry the dismiss handlers.
  const popupProps = dismiss.floating ?? EMPTY_OBJECT;

  usePopupInteractionProps(store, {
    activeTriggerProps,
    inactiveTriggerProps,
    popupProps,
    nestedOpenDialogCount: ownNestedOpenDialogs,
    nestedOpenDrawerCount: ownNestedOpenDrawers,
  });

  return null;
}
