"use client";

import { useEffect, useRef, useState } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";

const LOADING_FALLBACK_MS = 4500;
const LOADING_MIN_VISIBLE_MS = 360;

function currentRouteKey() {
  return `${window.location.pathname}${window.location.search}`;
}

type WebsiteLoadingNavigationInput = {
  altKey?: boolean;
  button?: number;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  download?: boolean;
  href: string | null;
  localOnly?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: string | null;
  windowHref: string;
};

export function resolveWebsiteLoadingNavigationTarget(input: WebsiteLoadingNavigationInput) {
  if (
    input.defaultPrevented ||
    (input.button ?? 0) !== 0 ||
    input.metaKey ||
    input.ctrlKey ||
    input.shiftKey ||
    input.altKey ||
    input.localOnly
  ) {
    return null;
  }
  if (input.download || (input.target && input.target !== "_self")) {
    return null;
  }

  const href = input.href;
  if (!href || href.startsWith("#")) return null;

  let nextUrl: URL;
  let currentUrl: URL;
  try {
    currentUrl = new URL(input.windowHref);
    nextUrl = new URL(href, currentUrl.href);
  } catch {
    return null;
  }

  if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") return null;
  if (nextUrl.href === currentUrl.href) return null;
  if (
    nextUrl.origin === currentUrl.origin &&
    nextUrl.pathname === currentUrl.pathname &&
    nextUrl.search === currentUrl.search &&
    nextUrl.hash
  ) {
    return null;
  }

  return {
    routeKey: `${nextUrl.pathname}${nextUrl.search}`,
    sameOrigin: nextUrl.origin === currentUrl.origin,
  };
}

type WebsiteLoadingTransitionProps = {
  label: string;
};

export function WebsiteLoadingTransition({ label }: WebsiteLoadingTransitionProps) {
  const [visible, setVisible] = useState(false);
  const currentRouteRef = useRef<string | null>(null);
  const visibleSinceRef = useRef<number>(0);

  useEffect(() => {
    currentRouteRef.current = currentRouteKey();
    let hideAfterMinTimer: number | undefined;
    let hideTimer: number | undefined;
    let pathTimer: number | undefined;

    const clearLoading = (respectMinimum = false) => {
      window.clearTimeout(hideAfterMinTimer);
      window.clearTimeout(hideTimer);
      window.clearInterval(pathTimer);
      if (respectMinimum) {
        const elapsed = window.performance.now() - visibleSinceRef.current;
        const remaining = Math.max(0, LOADING_MIN_VISIBLE_MS - elapsed);
        if (remaining > 0) {
          hideAfterMinTimer = window.setTimeout(() => clearLoading(false), remaining);
          return;
        }
      }
      currentRouteRef.current = currentRouteKey();
      setVisible(false);
    };

    const showLoading = (target: { routeKey: string; sameOrigin: boolean }) => {
      window.clearTimeout(hideAfterMinTimer);
      window.clearTimeout(hideTimer);
      window.clearInterval(pathTimer);
      currentRouteRef.current = currentRouteKey();
      visibleSinceRef.current = window.performance.now();
      setVisible(true);
      hideTimer = window.setTimeout(clearLoading, LOADING_FALLBACK_MS);

      if (target.sameOrigin) {
        pathTimer = window.setInterval(() => {
          const routeKey = currentRouteKey();
          if (routeKey === target.routeKey || currentRouteRef.current !== routeKey) {
            clearLoading(true);
          }
        }, 80);
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const navigationTarget = resolveWebsiteLoadingNavigationTarget({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        download: anchor.hasAttribute("download"),
        href: anchor.getAttribute("href"),
        localOnly: anchor.hasAttribute("data-local-models-filter"),
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        target: anchor.getAttribute("target"),
        windowHref: window.location.href,
      });
      if (!navigationTarget) return;
      showLoading(navigationTarget);
    };

    const onPageShow = () => clearLoading();
    const onVisibilityChange = () => {
      if (!document.hidden && currentRouteRef.current !== currentRouteKey()) {
        clearLoading();
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(hideAfterMinTimer);
      window.clearTimeout(hideTimer);
      window.clearInterval(pathTimer);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fk-page-loading fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-[#F7F4EC]/98 px-4 dark:bg-[#050507]/98"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="fk-page-loading-card relative flex w-[min(90vw,21rem)] flex-col items-center justify-center rounded-[18px] border border-[#0b0b0f1a] bg-white/92 px-7 pb-[1.35rem] pt-[1.6rem] shadow-[0_24px_70px_-36px_rgba(46,16,101,0.38)] backdrop-blur-[18px] dark:border-white/12 dark:bg-[#12121a]/90 dark:shadow-[0_24px_70px_-36px_rgba(0,0,0,0.78)]">
        <span
          className="pointer-events-none absolute inset-px rounded-[17px] bg-gradient-to-b from-white/75 to-transparent dark:from-white/8"
          aria-hidden="true"
        />
        <FlatkeyBrandLogo className="fk-page-loading-logo relative z-10 [&_[data-flatkey-wordmark='true']]:!text-[34px] [&_[data-flatkey-wordmark='true']]:!text-[#0b0b0f] dark:[&_[data-flatkey-wordmark='true']]:!text-[#f5f5f2]" />
        <span
          className="fk-page-loading-track relative z-10 mt-5 block h-[3px] w-[min(100%,13.5rem)] overflow-hidden rounded-full bg-[#5b21b61f] dark:bg-white/12"
          aria-hidden="true"
        >
          <span className="fk-page-loading-track-bar absolute inset-y-0 left-0 block w-[44%] rounded-full bg-[linear-gradient(90deg,transparent,#5b21b6_24%,#7c3aed_74%,transparent)] dark:bg-[linear-gradient(90deg,transparent,#c4b5fd_24%,#fff_74%,transparent)]" />
        </span>
      </div>
    </div>
  );
}
