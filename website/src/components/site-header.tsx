"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { LANGUAGE_PREFERENCE_COOKIE } from "@/lib/language-routing";
import { getCopy } from "@/lib/copy";
import { LOCALE_LABELS, LOCALES, type Locale, localeLanguageTag, localizePath, stripLocale, withIdFallback } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";
import { cn } from "@/lib/utils";

const startFreeLabelByLocale: Record<Locale, string> = withIdFallback({
  en: "Start free",
  zh: "免费开始",
  es: "Empieza gratis",
  fr: "Commencer gratuitement",
  pt: "Começar grátis",
  ru: "Начать бесплатно",
  ja: "無料で開始",
  vi: "Bắt đầu miễn phí",
  de: "Kostenlos starten",
});

type Props = {
  locale: Locale;
  pathname: string;
  languageCookieDomain?: string;
  /** Paid-search pages opt in so desktop navigation matches the static homepage at 1024px+. */
  expandNavigationAtTablet?: boolean;
  hideLanguageSwitcher?: boolean;
};

type NavItem = {
  external?: boolean;
  href: string;
  label: string;
  publicPath?: boolean;
};

function languageCookie(locale: Locale, domain?: string) {
  const domainAttribute = domain ? `; Domain=${domain}` : "";
  return `${LANGUAGE_PREFERENCE_COOKIE}=${locale}; Path=/${domainAttribute}; Max-Age=31536000; SameSite=Lax`;
}

function StaticLanguageSelect(props: { cookieDomain?: string; locale: Locale; pathname: string }) {
  const strippedPath = stripLocale(props.pathname);

  return (
    <select
      aria-label="Change language"
      value={props.locale}
      onChange={(event) => {
        const nextLocale = event.currentTarget.value as Locale;
        document.cookie = languageCookie(nextLocale, props.cookieDomain);
        window.location.href = localizePath(strippedPath, nextLocale);
      }}
      className="h-9 max-w-[120px] rounded-lg border border-[#0B0B0F14] bg-white px-2.5 text-[13.5px] font-semibold text-[#43434C] outline-none transition-colors hover:border-[#0B0B0F]"
    >
      {LOCALES.map((locale) => (
        <option key={locale} value={locale} lang={localeLanguageTag(locale)}>
          {LOCALE_LABELS[locale]}
        </option>
      ))}
    </select>
  );
}

export function SiteHeader(props: Props) {
  const copy = getCopy(props.locale);
  const startFreeLabel = startFreeLabelByLocale[props.locale] ?? startFreeLabelByLocale.en;
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = stripLocale(props.pathname);
  const signInHref = consoleUrl("/sign-in", `lng=${props.locale}`);
  const signUpHref = consoleUrl("/sign-up", `lng=${props.locale}`);
  const showContactAction = currentPath !== "/contact";
  const desktopNavigation = props.expandNavigationAtTablet
    ? { show: "min-[1024px]:flex", hide: "min-[1024px]:hidden" }
    : { show: "min-[1180px]:flex", hide: "min-[1180px]:hidden" };

  useEffect(() => {
    if (!props.expandNavigationAtTablet) return;

    const media = window.matchMedia("(min-width: 1024px)");
    const closeMobileMenuAtDesktop = () => {
      if (media.matches) setMobileOpen(false);
    };

    closeMobileMenuAtDesktop();
    if (media.addEventListener) {
      media.addEventListener("change", closeMobileMenuAtDesktop);
      return () => media.removeEventListener("change", closeMobileMenuAtDesktop);
    }

    media.addListener(closeMobileMenuAtDesktop);
    return () => media.removeListener(closeMobileMenuAtDesktop);
  }, [props.expandNavigationAtTablet]);

  const docsItem: NavItem = { href: "/docs", label: copy.nav.docs, publicPath: true };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const renderNavLink = (item: NavItem, compact = false, withDot = false) => {
    const active = item.publicPath && currentPath === item.href;
    const className = cn(
      compact
        ? "block rounded-lg px-3 py-2.5 text-base font-semibold"
        : "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-[13px] font-semibold",
      active ? "text-[#0B0B0F]" : "text-[#43434C] hover:text-[#0B0B0F]"
    );
    const children = (
      <>
        {withDot ? <span className={cn("size-1.5 rounded-full", active ? "bg-violet-600" : "bg-[#aaa7b0]")} aria-hidden="true" /> : null}
        {item.label}
      </>
    );

    return item.external ? (
      <a key={item.href} className={className} href={item.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <Link key={item.href} className={className} href={item.publicPath ? localizePath(item.href, props.locale) : item.href} onClick={() => setMobileOpen(false)}>
        {children}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#0B0B0F14] bg-white/95 backdrop-blur-md">
      <nav className="flex h-[76px] items-center gap-4 px-5 text-[#0B0B0F] min-[1180px]:gap-3 min-[1320px]:px-8">
        <Link href={localizePath("/", props.locale)} className="mr-1 inline-flex shrink-0 items-center">
          <FlatkeyBrandLogo className="[&_[data-flatkey-wordmark='true']]:text-[30px] [&_img]:h-10 [&_img]:w-10 min-[1480px]:[&_[data-flatkey-wordmark='true']]:text-[32px] min-[1480px]:[&_img]:h-11 min-[1480px]:[&_img]:w-11" />
          <span className="sr-only">flatkey.ai</span>
        </Link>

        <div className={cn("hidden min-w-0 flex-1 items-center gap-1", desktopNavigation.show)}>
          {renderNavLink(docsItem)}
        </div>

        <div className={cn("ml-auto hidden shrink-0 items-center gap-2", desktopNavigation.show)}>
          <a className="inline-flex h-9 items-center whitespace-nowrap px-2 text-[13px] font-semibold text-[#0B0B0F] hover:text-[#4C1D95]" href={signInHref}>
            {copy.nav.signIn}
          </a>
          {!props.hideLanguageSwitcher && (
            <StaticLanguageSelect locale={props.locale} pathname={props.pathname} cookieDomain={props.languageCookieDomain} />
          )}
          {showContactAction && (
            <Link
              className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-white px-4 text-[13px] font-bold text-[#0B0B0F] shadow-[inset_0_0_0_1px_#0B0B0F14,0_1px_2px_rgba(11,11,15,.06)] hover:-translate-y-px"
              href={localizePath("/contact", props.locale)}
            >
              {copy.nav.contact}
            </Link>
          )}
          <a
            className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-[#070707] px-4 text-[13px] font-bold text-white hover:-translate-y-px"
            href={signUpHref}
            style={{ color: "#fff" }}
          >
            {startFreeLabel} →
          </a>
        </div>

        <button
          type="button"
          className={cn(
            "ml-auto inline-flex size-[42px] items-center justify-center rounded-[10px] border border-[#0B0B0F14] bg-white text-[#0B0B0F]",
            desktopNavigation.hide
          )}
          aria-label={copy.nav.toggle}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-x-0 top-[76px] z-40 border-b border-[#0B0B0F14] bg-white px-5 py-4 shadow-[0_22px_60px_-42px_rgba(11,11,15,.45)] transition",
          desktopNavigation.hide,
          mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        )}
      >
        <div className="grid gap-1">{renderNavLink(docsItem, true)}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#0B0B0F14] pt-4">
          <a className="inline-flex h-10 items-center px-3 text-sm font-semibold" href={signInHref}>
            {copy.nav.signIn}
          </a>
          {!props.hideLanguageSwitcher && (
            <StaticLanguageSelect locale={props.locale} pathname={props.pathname} cookieDomain={props.languageCookieDomain} />
          )}
          {showContactAction && (
            <Link className="inline-flex h-10 items-center rounded-lg bg-white px-3 text-sm font-bold shadow-[inset_0_0_0_1px_#0B0B0F14]" href={localizePath("/contact", props.locale)} onClick={() => setMobileOpen(false)}>
              {copy.nav.contact}
            </Link>
          )}
          <a className="inline-flex h-10 items-center rounded-lg bg-[#070707] px-3 text-sm font-bold text-white" href={signUpHref} style={{ color: "#fff" }}>
            {startFreeLabel} →
          </a>
        </div>
      </div>
    </header>
  );
}
