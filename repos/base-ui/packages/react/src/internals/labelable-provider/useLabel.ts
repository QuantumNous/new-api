'use client';
import * as React from 'react';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '@base-ui/utils/owner';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { getTarget } from '../../floating-ui-react/utils';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useLabelableContext } from './LabelableContext';

export function useLabel(params: UseLabelParameters = {}): UseLabelReturnValue {
  const {
    id: idProp,
    fallbackControlId,
    native = false,
    setLabelId: setLabelIdProp,
    focusControl: focusControlProp,
  } = params;

  const { controlId: contextControlId, setLabelId: setContextLabelId } = useLabelableContext();

  const syncLabelId = useStableCallback((nextLabelId: string | undefined) => {
    setContextLabelId(nextLabelId);
    setLabelIdProp?.(nextLabelId);
  });

  const id = useRegisteredLabelId(idProp, syncLabelId);

  const resolvedControlId = contextControlId ?? fallbackControlId;

  function focusControl(event: React.MouseEvent) {
    if (focusControlProp) {
      focusControlProp(event, resolvedControlId);
      return;
    }

    if (!resolvedControlId) {
      return;
    }

    const controlElement = ownerDocument(event.currentTarget).getElementById(resolvedControlId);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: React.MouseEvent) {
    const target = getTarget(event.nativeEvent) as HTMLElement | null;
    if (target?.closest('button,input,select,textarea')) {
      return;
    }

    // Prevent text selection when double clicking label.
    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (native) {
      return;
    }

    focusControl(event);
  }

  return native
    ? {
        id,
        htmlFor: resolvedControlId ?? undefined,
        onMouseDown: handleInteraction,
      }
    : {
        id,
        onClick: handleInteraction,
        onPointerDown(event: React.PointerEvent) {
          event.preventDefault();
        },
      };
}

export interface UseLabelParameters {
  id?: string | undefined;
  /**
   * Control id used when no labelable context control id exists.
   */
  fallbackControlId?: string | null | undefined;
  /**
   * Whether the rendered element is a native `<label>`.
   * @default false
   */
  native?: boolean | undefined;
  /**
   * Additional callback to sync the current label id with local component state/store.
   */
  setLabelId?: ((nextLabelId: string | undefined) => void) | undefined;
  /**
   * Custom focus handler for non-native labels.
   * If omitted, focus behavior targets the resolved control id.
   */
  focusControl?:
    | ((event: React.MouseEvent, controlId: string | null | undefined) => void)
    | undefined;
}

export type UseLabelReturnValue = React.HTMLAttributes<any> & React.LabelHTMLAttributes<any>;

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({
    // Available from Chrome 144+ (January 2026).
    // Safari and Firefox already support it.
    focusVisible: true,
  });
}
