// app/RouteChangeListener.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function Scroller() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // const firstRender = useRef(true);

  // run after every route or query-string change
  // biome-ignore lint:
  useEffect(() => {
    // skip the very first render if you only care about later navigations
    handleScroll();
    // firstRender.current = false;
  }, [pathname, searchParams]);

  // also run once on the initial load (optional)
  useEffect(handleScroll, []);

  function handleScroll() {
    console.dir("handling scroll...", { depth: null });
    // accept either ?id=foo or #foo
    const id = searchParams?.get("id") ?? window.location.hash.slice(1);
    const el = id ? document.getElementById(id) : null;
    el?.scrollIntoView();
  }

  return null;
}
