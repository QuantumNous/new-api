import { isElement } from '@floating-ui/utils/dom';
import type * as React from 'react';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getTarget, isInteractiveElement } from '../../floating-ui-react/utils/element';
import type { ComboboxStore } from '../store';

export function handleInputPress(
  event: React.MouseEvent<HTMLElement> & { baseUIHandlerPrevented?: boolean | undefined },
  store: ComboboxStore,
  disabled: boolean,
  readOnly: boolean,
  shouldIgnoreTarget?: ((target: Element | null) => boolean) | undefined,
) {
  if (event.baseUIHandlerPrevented || readOnly) {
    return;
  }

  const target = getTarget(event.nativeEvent);
  const targetElement = isElement(target) ? target : null;
  if (
    targetElement !== event.currentTarget &&
    (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))
  ) {
    return;
  }

  event.preventDefault();

  if (disabled) {
    return;
  }

  store.state.inputRef.current?.focus();

  if (store.state.openOnInputClick) {
    store.state.setOpen(true, createChangeEventDetails(REASONS.inputPress, event.nativeEvent));
  }
}
