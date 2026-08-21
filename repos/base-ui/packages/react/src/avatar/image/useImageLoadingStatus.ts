'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { NOOP } from '../../internals/noop';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

interface UseImageLoadingStatusOptions {
  referrerPolicy?: React.HTMLAttributeReferrerPolicy | undefined;
  crossOrigin?: React.ImgHTMLAttributes<HTMLImageElement>['crossOrigin'] | undefined;
  sizes?: React.ImgHTMLAttributes<HTMLImageElement>['sizes'] | undefined;
  srcSet?: React.ImgHTMLAttributes<HTMLImageElement>['srcSet'] | undefined;
}

export function useImageLoadingStatus(
  src: string | undefined,
  { referrerPolicy, crossOrigin, sizes, srcSet }: UseImageLoadingStatusOptions,
): ImageLoadingStatus {
  const [loadingStatus, setLoadingStatus] = React.useState<ImageLoadingStatus>('idle');

  useIsoLayoutEffect(() => {
    if (!src && !srcSet) {
      setLoadingStatus('error');
      return NOOP;
    }

    let isMounted = true;
    const image = new window.Image();

    const updateStatus = (status: ImageLoadingStatus) => () => {
      if (!isMounted) {
        return;
      }

      setLoadingStatus(status);
    };

    setLoadingStatus('loading');
    image.onload = updateStatus('loaded');
    image.onerror = updateStatus('error');
    if (referrerPolicy) {
      image.referrerPolicy = referrerPolicy;
    }
    image.crossOrigin = crossOrigin ?? null;
    if (sizes) {
      image.sizes = sizes;
    }
    if (srcSet) {
      image.srcset = srcSet;
    }
    if (src) {
      image.src = src;
    }

    // Fast path for cached/decoded images
    if (image.complete) {
      setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
    }

    return () => {
      isMounted = false;
    };
  }, [src, srcSet, sizes, crossOrigin, referrerPolicy]);

  return loadingStatus;
}
