"use client";

import { useEffect } from "react";

export function SmoothScroll({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let lenis: { destroy(): void } | undefined;

    async function syncSmoothScrolling() {
      if (reducedMotionQuery.matches) {
        lenis?.destroy();
        lenis = undefined;
        return;
      }

      if (lenis) return;

      const { default: Lenis } = await import("lenis");
      if (disposed || reducedMotionQuery.matches) return;
      lenis = new Lenis({ autoRaf: true });
    }

    function handlePreferenceChange() {
      void syncSmoothScrolling();
    }

    void syncSmoothScrolling();
    reducedMotionQuery.addEventListener("change", handlePreferenceChange);

    return () => {
      disposed = true;
      reducedMotionQuery.removeEventListener("change", handlePreferenceChange);
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
