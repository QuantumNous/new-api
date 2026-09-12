import type { ClientConfig } from '../types';

export const isBuildOverlayEnabled = (overlay: ClientConfig['overlay']): boolean =>
  overlay === true || (typeof overlay === 'object' && overlay.errors !== false);

export const isRuntimeOverlayEnabled = (overlay: ClientConfig['overlay']): boolean =>
  typeof overlay === 'object' &&
  (overlay.runtime === true || typeof overlay.runtime === 'function');

export const isOverlayEnabled = (overlay: ClientConfig['overlay']): boolean =>
  isBuildOverlayEnabled(overlay) || isRuntimeOverlayEnabled(overlay);
