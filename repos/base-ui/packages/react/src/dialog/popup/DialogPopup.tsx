'use client';
import * as React from 'react';
import { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { FloatingFocusManager } from '../../floating-ui-react';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { type BaseUIComponentProps } from '../../internals/types';
import { type TransitionStatus } from '../../internals/useTransitionStatus';
import { type StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { DialogPopupCssVars } from './DialogPopupCssVars';
import { DialogPopupDataAttributes } from './DialogPopupDataAttributes';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { FOCUSABLE_POPUP_PROPS, createDefaultInitialFocus } from '../../utils/popups';

const stateAttributesMapping: StateAttributesMapping<DialogPopupState> = {
  ...baseMapping,
  ...transitionStatusMapping,
  nestedDialogOpen(value) {
    return value ? { [DialogPopupDataAttributes.nestedDialogOpen]: '' } : null;
  },
};

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export const DialogPopup = React.forwardRef(function DialogPopup(
  componentProps: DialogPopup.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, finalFocus, initialFocus, ...elementProps } = componentProps;

  const { store } = useDialogRootContext();

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const floatingRootContext = store.useState('floatingRootContext');
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const transitionStatus = store.useState('transitionStatus');
  const role = store.useState('role');
  const floatingId = floatingRootContext.useState('floatingId');

  const popupId = elementProps.id ?? floatingId;

  useDialogPortalContext();

  useOpenChangeComplete({
    open,
    ref: store.context.popupRef,
    onComplete() {
      if (open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus =
    initialFocus === undefined ? createDefaultInitialFocus(store.context.popupRef) : initialFocus;

  const nestedDialogOpen = nestedOpenDialogCount > 0;

  const setPopupElement = store.useStateSetter('popupElement');

  const state: DialogPopupState = {
    open,
    nested,
    transitionStatus,
    nestedDialogOpen,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      rootPopupProps,
      {
        id: popupId,
        'aria-labelledby': titleElementId ?? undefined,
        'aria-describedby': descriptionElementId ?? undefined,
        role,
        ...FOCUSABLE_POPUP_PROPS,
        hidden: !mounted,
        onKeyDown(event: React.KeyboardEvent) {
          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        style: {
          [DialogPopupCssVars.nestedDialogs]: nestedOpenDialogCount,
        } as React.CSSProperties,
      },
      elementProps,
    ],
    ref: [forwardedRef, store.context.popupRef, setPopupElement],
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

export interface DialogPopupProps extends BaseUIComponentProps<'div', DialogPopupState> {
  /**
   * Determines the element to focus when the dialog is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the dialog
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
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the dialog is closed.
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
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within a parent dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export namespace DialogPopup {
  export type Props = DialogPopupProps;
  export type State = DialogPopupState;
}
