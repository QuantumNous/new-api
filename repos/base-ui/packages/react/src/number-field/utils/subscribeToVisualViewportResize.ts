import { addEventListener } from '@base-ui/utils/addEventListener';
import { ownerWindow } from '@base-ui/utils/owner';

// This lets us invert the scale of the cursor to match the OS scale, in which the cursor doesn't
// scale with the content on pinch-zoom.
export function subscribeToVisualViewportResize(
  element: Element,
  visualScaleRef: React.RefObject<number>,
) {
  const vV = ownerWindow(element).visualViewport;

  if (!vV) {
    return () => {};
  }

  function handleVisualResize() {
    if (vV) {
      visualScaleRef.current = vV.scale;
    }
  }

  handleVisualResize();
  return addEventListener(vV, 'resize', handleVisualResize);
}
