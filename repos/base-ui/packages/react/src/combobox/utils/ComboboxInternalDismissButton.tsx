'use client';
import * as React from 'react';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

type DismissEvent = React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>;

/**
 * @internal
 */
export const ComboboxInternalDismissButton = React.forwardRef<HTMLSpanElement>(
  function ComboboxInternalDismissButton(_, forwardedRef) {
    const store = useComboboxRootContext();

    const { buttonRef, getButtonProps } = useButton({
      native: false,
    });

    const mergedRef = useMergedRefs(forwardedRef, buttonRef);

    function handleDismiss(event: DismissEvent) {
      store.state.setOpen(
        false,
        createChangeEventDetails(REASONS.closePress, event.nativeEvent, event.currentTarget),
      );
    }

    const dismissProps = getButtonProps({
      onClick: handleDismiss,
    });

    return (
      <span
        ref={mergedRef}
        {...dismissProps}
        aria-label="Dismiss"
        tabIndex={undefined}
        style={visuallyHiddenInput}
      />
    );
  },
);
