'use client';
import * as React from 'react';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export const AvatarFallback = React.forwardRef(function AvatarFallback(
  componentProps: AvatarFallback.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { className, render, delay, style, ...elementProps } = componentProps;

  const { imageLoadingStatus } = useAvatarRootContext();
  const [delayPassed, setDelayPassed] = React.useState(delay === undefined);
  const timeout = useTimeout();

  React.useEffect(() => {
    if (delay !== undefined) {
      timeout.start(delay, () => setDelayPassed(true));
    } else {
      // Once the fallback is shown without a delay, keep it visible. Otherwise a later
      // `undefined` -> number change would re-hide an already-visible fallback.
      setDelayPassed(true);
    }
    return timeout.clear;
  }, [timeout, delay]);

  const state: AvatarFallbackState = {
    imageLoadingStatus,
  };

  const element = useRenderElement('span', componentProps, {
    state,
    ref: forwardedRef,
    props: elementProps,
    stateAttributesMapping: avatarStateAttributesMapping,
    enabled: imageLoadingStatus !== 'loaded' && (delay === undefined || delayPassed),
  });

  return element;
});

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackProps extends BaseUIComponentProps<'span', AvatarFallbackState> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   */
  delay?: number | undefined;
}

export namespace AvatarFallback {
  export type State = AvatarFallbackState;
  export type Props = AvatarFallbackProps;
}
