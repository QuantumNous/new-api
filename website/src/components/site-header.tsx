"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationPopover } from "@/components/notification-popover";
import { getCopy } from "@/lib/copy";
import { type Locale, localizePath, stripLocale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";
import { cn } from "@/lib/utils";

const SIGN_IN_URL = consoleUrl("/sign-in");
const CONSOLE_URL = consoleUrl("/dashboard");
const useCaseItems = [
  { href: "/use-case/codex", label: "Codex" },
  { href: "/use-case/claude-code", label: "Claude Code" },
  { href: "/use-case/image-buddy", label: "Image Buddy" },
];
const useCaseLabelByLocale: Record<Locale, string> = {
  en: "Use Case",
  zh: "使用场景",
  es: "Casos de uso",
  fr: "Cas d'usage",
  pt: "Casos de uso",
  ru: "Сценарии",
  ja: "ユースケース",
  vi: "Use case",
  de: "Anwendungsfälle",
};

type Props = {
  locale: Locale;
  pathname: string;
};

export function SiteHeader(props: Props) {
  const copy = getCopy(props.locale);
  const useCaseLabel = useCaseLabelByLocale[props.locale] ?? useCaseLabelByLocale.en;
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { href: "/", label: copy.nav.home, publicPath: true },
    { href: "/blog", label: copy.nav.blog, publicPath: true },
    { href: "/pricing", label: copy.nav.pricing, publicPath: true },
    { href: "/models", label: copy.nav.modelPricing, publicPath: true },
    // Rankings is the website's own daily-updated data page (same pipeline
    // as the console chart) — the single public rankings surface.
    { href: "/rankings", label: copy.nav.rankings, publicPath: true },
  ];
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
            scrolled ? "max-w-[52rem] px-3 pt-3 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl" : "max-w-7xl px-4 pt-0 md:px-6"
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
                const active = item.publicPath && currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    href={item.publicPath ? localizePath(item.href, props.locale) : item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="group/usecase relative">
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
                    currentPath.startsWith("/use-case") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-haspopup="menu"
                >
                  {useCaseLabel}
                  <ChevronDown className="size-3.5 transition-transform group-hover/usecase:rotate-180" />
                </button>
                <div className="pointer-events-none absolute top-full left-0 z-50 pt-2 opacity-0 transition-opacity duration-150 group-hover/usecase:pointer-events-auto group-hover/usecase:opacity-100 group-focus-within/usecase:pointer-events-auto group-focus-within/usecase:opacity-100">
                  <div className="min-w-44 rounded-xl border border-border/70 bg-background/96 p-1.5 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                    {useCaseItems.map((item) => (
                      <Link
                        key={item.href}
                        href={localizePath(item.href, props.locale)}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          currentPath === item.href ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <Link
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
                  currentPath === "/contact" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                href={localizePath("/contact", props.locale)}
              >
                {copy.nav.contact}
              </Link>

              <div className="mx-2 h-4 w-px bg-border/40" />
              <LanguageSwitcher locale={props.locale} pathname={props.pathname} />
              <NotificationPopover locale={props.locale} />
              <div className="mx-1 h-4 w-px bg-border/40" />
              <a
                className="inline-flex h-8 items-center justify-center rounded-lg border border-border/70 px-3.5 text-xs font-medium text-foreground/80 transition-colors hover:border-border hover:text-foreground"
                href={CONSOLE_URL}
              >
                {copy.nav.console}
              </a>
              <a
                className="flatkey-primary-cta inline-flex h-8 items-center justify-center rounded-lg px-3.5 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80"
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
                href={item.publicPath ? localizePath(item.href, props.locale) : item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                  item.publicPath && currentPath === item.href ? "text-foreground" : "text-muted-foreground"
                )}
                style={{ transitionDelay: mobileOpen ? `${100 + index * 50}ms` : "0ms" }}
              >
                {item.label}
              </Link>
            ))}
            <div
              className={cn(
                "pt-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: mobileOpen ? `${100 + navItems.length * 50}ms` : "0ms" }}
            >
              <div className="text-muted-foreground pb-1 text-xs font-semibold tracking-wide uppercase">{useCaseLabel}</div>
              {useCaseItems.map((item) => (
                <Link
                  key={item.href}
                  href={localizePath(item.href, props.locale)}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block py-2 text-base font-medium tracking-tight",
                    currentPath === item.href ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              href={localizePath("/contact", props.locale)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                currentPath === "/contact" ? "text-foreground" : "text-muted-foreground"
              )}
              style={{ transitionDelay: mobileOpen ? `${150 + navItems.length * 50}ms` : "0ms" }}
            >
              {copy.nav.contact}
            </Link>
          </nav>

          <div
            className={cn(
              "flex flex-col gap-3 transition-all duration-500",
              mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
            style={{ transitionDelay: mobileOpen ? "250ms" : "0ms" }}
          >
            <a
              href={CONSOLE_URL}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border/70 text-sm font-medium text-foreground/80 transition-colors hover:border-border hover:text-foreground"
            >
              {copy.nav.console}
            </a>
            <a
              href={SIGN_IN_URL}
              className="flatkey-primary-cta inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80"
            >
              {copy.nav.signIn}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
