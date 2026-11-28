import { ownerWindow } from '@base-ui/utils/owner';

// Calculates the bounds the virtual cursor wraps within, as absolute edge coordinates.
export function getViewportRect(teleportDistance: number | undefined, scrubAreaEl: HTMLElement) {
  const win = ownerWindow(scrubAreaEl);

  if (teleportDistance != null) {
    const rect = scrubAreaEl.getBoundingClientRect();
    return {
      left: rect.left - teleportDistance / 2,
      top: rect.top - teleportDistance / 2,
      right: rect.right + teleportDistance / 2,
      bottom: rect.bottom + teleportDistance / 2,
    };
  }

  const vV = win.visualViewport;

  if (vV) {
    return {
      left: vV.offsetLeft,
      top: vV.offsetTop,
      right: vV.offsetLeft + vV.width,
      bottom: vV.offsetTop + vV.height,
    };
  }

  return {
    left: 0,
    top: 0,
    right: win.document.documentElement.clientWidth,
    bottom: win.document.documentElement.clientHeight,
  };
}
