'use client';
import * as React from 'react';
import { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { AvatarRootContext } from './AvatarRootContext';
import { avatarStateAttributesMapping } from './stateAttributesMapping';

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export const AvatarRoot = React.forwardRef(function AvatarRoot(
  componentProps: AvatarRoot.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { className, render, style, ...elementProps } = componentProps;

  const [imageLoadingStatus, setImageLoadingStatus] = React.useState<ImageLoadingStatus>('idle');

  const state: AvatarRootState = {
    imageLoadingStatus,
  };

  const contextValue = React.useMemo(
    () => ({
      imageLoadingStatus,
      setImageLoadingStatus,
    }),
    [imageLoadingStatus, setImageLoadingStatus],
  );

  const element = useRenderElement('span', componentProps, {
    state,
    ref: forwardedRef,
    props: elementProps,
    stateAttributesMapping: avatarStateAttributesMapping,
  });

  return <AvatarRootContext.Provider value={contextValue}>{element}</AvatarRootContext.Provider>;
});

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  /**
   * The image loading status.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarRootProps extends BaseUIComponentProps<'span', AvatarRootState> {}

export namespace AvatarRoot {
  export type State = AvatarRootState;
  export type Props = AvatarRootProps;
}
