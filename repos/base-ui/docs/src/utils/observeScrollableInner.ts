// Observe whether the inner node is scrollable and set a "[data-scrollable]"
// attribute on the parent node. We are rawdogging the DOM changes here to skip unnecessary renders.
export function observeScrollableInner(ref: HTMLElement | null) {
  if (!ref) {
    return undefined;
  }

  const inner = ref.children[0] as HTMLElement;
  let raf: ReturnType<typeof requestAnimationFrame> | null = null;
  const observer = new ResizeObserver(() => {
    const isScrollable = inner.scrollWidth > inner.offsetWidth;

    // Schedule the DOM update to happen in the next frame to avoid layout trashing.
    raf = requestAnimationFrame(() => {
      if (isScrollable) {
        ref.setAttribute('data-scrollable', '');
      } else {
        ref.removeAttribute('data-scrollable');
      }
      raf = null;
    });
  });

  if (inner) {
    observer.observe(inner);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn('Expected to find an inner element');
  }

  return () => {
    observer.disconnect();
    if (raf !== null) {
      cancelAnimationFrame(raf);
    }
  };
}
