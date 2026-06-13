"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCopy } from "@/lib/copy";
import { type Locale, localizePath, stripLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

const SIGN_IN_URL = process.env.NEXT_PUBLIC_SIGN_IN_URL ?? "/sign-in";

type Props = {
  locale: Locale;
  pathname: string;
};

export function SiteHeader(props: Props) {
  const copy = getCopy(props.locale);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [{ href: "/blog", label: copy.nav.blog }];
  const currentPath = stripLocale(props.pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
        <div
          className={cn(
            "pointer-events-auto mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
            scrolled ? "max-w-[52rem] px-3 pt-3" : "max-w-7xl px-4 pt-0 md:px-6"
          )}
        >
          <nav
            className={cn(
              "flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
              scrolled
                ? "h-12 rounded-2xl bg-background/60 pr-1.5 pl-4 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.02)] ring-[0.5px] ring-border/50 backdrop-blur-2xl"
                : "h-16 px-2"
            )}
          >
            <Link className="group flex shrink-0 items-center gap-2.5" href={localizePath("/", props.locale)}>
              <span className="flex h-11 shrink-0 items-center justify-center transition-all duration-300 group-hover:scale-[1.02]">
                <FlatkeyBrandLogo className="h-11" />
              </span>
              <span className="sr-only">flatkey.ai</span>
            </Link>

            <div className="hidden items-center gap-0.5 sm:flex">
              {navItems.map((item) => {
                const active = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    href={localizePath(item.href, props.locale)}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="mx-2 h-4 w-px bg-border/40" />
              <LanguageSwitcher locale={props.locale} pathname={props.pathname} />
              <div className="mx-1 h-4 w-px bg-border/40" />
              <a
                className="inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-opacity hover:opacity-90 active:opacity-80"
                href={SIGN_IN_URL}
              >
                {copy.nav.signIn}
              </a>
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setMobileOpen((value) => !value)}
                aria-label={copy.nav.toggle}
                aria-expanded={mobileOpen}
              >
                <span className="relative size-4" aria-hidden="true">
                  <span
                    className={cn(
                      "absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300",
                      mobileOpen ? "top-[7px] rotate-45" : "top-[3px]"
                    )}
                  />
                  <span
                    className={cn(
                      "absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-all duration-300",
                      mobileOpen ? "scale-x-0 opacity-0" : "opacity-100"
                    )}
                  />
                  <span
                    className={cn(
                      "absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300",
                      mobileOpen ? "top-[7px] -rotate-45" : "top-[11px]"
                    )}
                  />
                </span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/98 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:pointer-events-none sm:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex h-full flex-col justify-between px-8 pt-20 pb-10">
          <nav className="flex flex-col gap-1">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={localizePath(item.href, props.locale)}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                  currentPath === item.href ? "text-foreground" : "text-muted-foreground"
                )}
                style={{ transitionDelay: mobileOpen ? `${100 + index * 50}ms` : "0ms" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div
            className={cn(
              "flex flex-col gap-3 transition-all duration-500",
              mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
            style={{ transitionDelay: mobileOpen ? "250ms" : "0ms" }}
          >
            <a
              href={SIGN_IN_URL}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-80"
            >
              {copy.nav.signIn}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
