"use client";

import { useEffect, useState, type MouseEvent } from "react";

import type { DocTableOfContentsItem } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

export function DocsTableOfContents({ items }: { items: DocTableOfContentsItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  function handleAnchorClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const heading = document.getElementById(id);
    if (!heading) return;

    event.preventDefault();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });

    const url = new URL(window.location.href);
    url.hash = id;
    window.history.pushState(null, "", url.toString());
    setActiveId(id);
  }

  useEffect(() => {
    const scrollViewport = document.querySelector<HTMLElement>(
      '[data-docs-content-scroll] [data-slot="scroll-area-viewport"]',
    );
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading !== null);

    if (!scrollViewport || headings.length === 0) return;

    const viewport = scrollViewport;
    const visibleHeadingIds = new Set<string>();
    let scrollFrame = 0;

    function isScrollAtEnd() {
      return viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleHeadingIds.add(entry.target.id);
          } else {
            visibleHeadingIds.delete(entry.target.id);
          }
        }

        if (isScrollAtEnd()) {
          setActiveId(headings.at(-1)?.id ?? headings[0].id);
          return;
        }

        const nextActiveId = headings.find((heading) => visibleHeadingIds.has(heading.id))?.id;
        if (nextActiveId) setActiveId(nextActiveId);
      },
      {
        root: viewport,
        rootMargin: "0px 0px -65% 0px",
        threshold: 0,
      },
    );

    function handleScroll() {
      if (scrollFrame !== 0) return;

      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        if (isScrollAtEnd()) setActiveId(headings.at(-1)?.id ?? headings[0].id);
      });
    }

    for (const heading of headings) observer.observe(heading);
    viewport.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="本页目录" className="w-full select-none text-left">
      <p className="mb-3 font-medium text-neutral-500 [font-size:var(--docs-text-xs)]">本页内容</p>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <li key={`${item.id}-${item.depth}`}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => handleAnchorClick(event, item.id)}
                className={cn(
                  "block py-0.5 leading-snug font-medium text-neutral-600 opacity-55 outline-none transition-[color,opacity] duration-200 ease-out hover:text-neutral-950 hover:opacity-100 focus-visible:text-blue-600 focus-visible:opacity-100 [font-size:var(--docs-text-sm)]",
                  item.depth === 3 ? "pl-3" : "pl-0",
                  isActive && "font-semibold text-neutral-950 opacity-100",
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
