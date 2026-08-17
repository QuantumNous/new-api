"use client";

import Link from "next/link";
import { Check, ChevronDown, Globe2, Menu, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { useSiteConfig } from "@/components/site-config-provider";
import { buildLanguagePreferenceCookieWrites } from "@/lib/language-routing";
import { CLI_LANDING_PATH, cliLandingCopy } from "@/lib/cli-landing";
import { consoleSignInUrl } from "@/lib/console-auth-links";
import { getCopy } from "@/lib/copy";
import {
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  localeLanguageTag,
  localizePath,
  stripLocale,
  withIdFallback,
} from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";
import { TOOLS_LANDING_PATH, toolsLandingCopy } from "@/lib/tools-landing";
import {
  clearConsoleSessionHint,
  hasConsoleSessionHint,
  isVerifiedConsoleUserPayload,
  rememberConsoleSessionHint,
} from "@/lib/console-session-hint";
import { cn } from "@/lib/utils";

const legacyNavLabelByLocale: Record<
  Locale,
  {
    compute: string;
    enterprise: string;
    playground: string;
    status: string;
    usecases: string;
  }
> = withIdFallback({
  en: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Status",
    usecases: "Use Cases",
  },
  zh: {
    compute: "算力",
    enterprise: "企业版",
    playground: "Playground",
    status: "服务状态",
    usecases: "使用场景",
  },
  es: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Estado",
    usecases: "Casos de uso",
  },
  fr: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Statut",
    usecases: "Cas d'usage",
  },
  pt: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Status",
    usecases: "Casos de uso",
  },
  ru: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Статус",
    usecases: "Сценарии",
  },
  ja: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "ステータス",
    usecases: "ユースケース",
  },
  vi: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Trạng thái",
    usecases: "Use cases",
  },
  de: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Status",
    usecases: "Anwendungsfälle",
  },
  id: {
    compute: "Compute",
    enterprise: "Enterprise",
    playground: "Playground",
    status: "Status",
    usecases: "Use case",
  },
});

const startFreeLabelByLocale: Record<Locale, string> = withIdFallback({
  en: "Start Free",
  zh: "免费开始",
  es: "Empieza gratis",
  fr: "Commencer gratuitement",
  pt: "Começar grátis",
  ru: "Начать бесплатно",
  ja: "無料で開始",
  vi: "Bắt đầu miễn phí",
  de: "Kostenlos starten",
});

const navGroupLabelByLocale: Record<
  Locale,
  { menu: string; products: string; resources: string }
> = withIdFallback({
  en: { products: "Product", resources: "Resource", menu: "Menu" },
  zh: { products: "产品", resources: "资源", menu: "菜单" },
  es: { products: "Producto", resources: "Recursos", menu: "Menu" },
  fr: { products: "Produit", resources: "Ressources", menu: "Menu" },
  pt: { products: "Produto", resources: "Recursos", menu: "Menu" },
  ru: { products: "Продукт", resources: "Ресурсы", menu: "Меню" },
  ja: { products: "プロダクト", resources: "リソース", menu: "メニュー" },
  vi: { products: "Sản phẩm", resources: "Tài nguyên", menu: "Menu" },
  de: { products: "Produkt", resources: "Ressourcen", menu: "Menu" },
  id: { products: "Produk", resources: "Sumber daya", menu: "Menu" },
});

const languagePanelLabelByLocale: Record<Locale, string> = withIdFallback({
  en: "Language",
  zh: "语言",
  es: "Idioma",
  fr: "Langue",
  pt: "Idioma",
  ru: "Язык",
  ja: "言語",
  vi: "Ngôn ngữ",
  de: "Sprache",
  id: "Bahasa",
});

type Props = {
  locale: Locale;
  pathname: string;
  languageCookieDomain?: string;
  hideLanguageSwitcher?: boolean;
  /**
   * Paid-search pages opted into a 1024px desktop-navigation threshold. This header
   * already expands at 901px, so the flag is accepted for call-site compatibility
   * and needs no separate breakpoint handling.
   */
  expandNavigationAtTablet?: boolean;
};

type NavItem = {
  external?: boolean;
  href: string;
  label: string;
  publicPath?: boolean;
};

const mobileMenuSurfaceClass =
  "grid gap-0.5 rounded-xl border border-[#0B0B0F12] bg-white p-2";
const mobileMenuButtonClass =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#E7E4EC] bg-white text-[#0B0B0F] shadow-[0_1px_2px_rgba(24,14,38,.05)] transition duration-200 ease-out hover:border-[#D8D1E2] hover:bg-[#F8F4FF] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B8FF] focus-visible:ring-offset-2 min-[901px]:hidden";
const mobileMenuButtonOpenClass =
  "border-[#C9B8FF] bg-[#F3EDFF] text-[#6B46C1] shadow-[inset_0_0_0_1px_rgba(124,58,237,.18),0_12px_26px_-18px_rgba(76,29,149,.65)]";
const mobileNavRowClass =
  "flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold text-[#0B0B0F] transition hover:bg-[#F3EDFF] hover:text-[#6B46C1] focus-visible:bg-[#F3EDFF] focus-visible:text-[#6B46C1] focus-visible:outline-none";
const mobileNavActiveClass = "bg-[#F3EDFF] text-[#6B46C1]";
const mobileNavNestedClass = "grid gap-0.5 pt-0.5 pl-4";
const mobileNavOpenClass = "group-open:bg-[#F3EDFF] group-open:text-[#6B46C1]";
const desktopNavTriggerClass =
  "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-[12.75px] font-semibold text-[#4A4650] transition hover:bg-[#F7F2FF] hover:text-[#0B0B0F] min-[1120px]:gap-2 min-[1120px]:px-3 min-[1120px]:text-[13.5px] min-[1360px]:text-[14.5px]";
const desktopNavActiveClass = "bg-[#F7F2FF] text-[#0B0B0F]";
const desktopNavDotClass =
  "size-1.5 shrink-0 rounded-full bg-[#AAA7B0] transition group-hover/nav:bg-[#7C3AED]";
const desktopSecondaryActionClass =
  "inline-flex h-10 items-center whitespace-nowrap rounded-[9px] border border-[#E7E4EC] bg-white px-2.5 text-[13px] font-bold text-[#0B0B0F] no-underline shadow-[0_1px_2px_rgba(24,14,38,.05)] transition hover:border-[#D8D1E2] hover:bg-[#F8F4FF] hover:text-[#4C1D95] min-[1180px]:px-3 min-[1180px]:text-[13.5px] min-[1360px]:text-[14px]";
const desktopPrimaryActionClass =
  "inline-flex h-10 max-w-[10rem] items-center justify-center overflow-hidden whitespace-nowrap rounded-[9px] bg-[#070707] px-3 text-[13px] font-bold text-ellipsis text-white no-underline shadow-[0_10px_24px_-18px_rgba(11,11,15,.75)] transition hover:-translate-y-px hover:bg-[#17171B] min-[1180px]:h-11 min-[1180px]:max-w-[12rem] min-[1180px]:px-4 min-[1180px]:text-[13.5px] min-[1360px]:text-[14px]";
const headerLogoClass =
  "gap-2 [&_img]:!h-9 [&_img]:!w-9 [&_[data-flatkey-wordmark='true']]:!text-[28px] min-[1180px]:gap-[9px] min-[1180px]:[&_img]:!h-10 min-[1180px]:[&_img]:!w-10 min-[1180px]:[&_[data-flatkey-wordmark='true']]:!text-[32px] min-[1480px]:[&_img]:!h-11 min-[1480px]:[&_img]:!w-11 min-[1480px]:[&_[data-flatkey-wordmark='true']]:!text-[36px]";

function persistLanguagePreference(locale: Locale, cookieDomain?: string) {
  for (const cookie of buildLanguagePreferenceCookieWrites(
    locale,
    cookieDomain,
  )) {
    document.cookie = cookie;
  }
}

function HeaderLanguageMenu(props: {
  cookieDomain?: string;
  locale: Locale;
  pathname: string;
  variant?: "dropdown" | "panel";
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const strippedPath = stripLocale(props.pathname);
  const languageLinks = useMemo(
    () =>
      LOCALES.map((locale) => ({
        code: locale,
        href: localizePath(strippedPath, locale),
        label: LOCALE_LABELS[locale],
      })),
    [strippedPath],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLanguageClick = (locale: Locale) => {
    persistLanguagePreference(locale, props.cookieDomain);
    setOpen(false);
  };

  if (props.variant === "panel") {
    return (
      <details className="group">
        <summary
          className={cn(
            mobileNavRowClass,
            mobileNavOpenClass,
            "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {languagePanelLabelByLocale[props.locale]}
          </span>
          <ChevronDown
            className="ml-auto size-4 shrink-0 text-[#8D8994] transition group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <nav aria-label="Change language" className={mobileNavNestedClass}>
          {languageLinks.map((lang) => (
            <a
              key={lang.code}
              className={cn(
                mobileNavRowClass,
                props.locale === lang.code && mobileNavActiveClass,
              )}
              href={lang.href}
              hrefLang={localeLanguageTag(lang.code)}
              lang={localeLanguageTag(lang.code)}
              aria-current={props.locale === lang.code ? "page" : undefined}
              onClick={() => handleLanguageClick(lang.code)}
            >
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {lang.label}
              </span>
              <Check
                className={cn(
                  "ml-auto size-4 shrink-0",
                  props.locale !== lang.code && "invisible",
                )}
                aria-hidden="true"
              />
            </a>
          ))}
        </nav>
      </details>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-full border border-[#E7E4EC] bg-white text-[#45414C] shadow-[0_1px_2px_rgba(24,14,38,.05)] transition hover:border-[#D8D1E2] hover:bg-[#F8F4FF] hover:text-[#0B0B0F] aria-expanded:border-[#D8D1E2] aria-expanded:bg-[#F8F4FF] aria-expanded:text-[#0B0B0F] min-[1180px]:size-10"
        aria-label="Change language"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 className="size-[17px] min-[1180px]:size-[18px]" aria-hidden="true" />
      </button>

      <nav
        id={menuId}
        aria-label="Change language"
        className={cn(
          "absolute right-0 top-[calc(100%+10px)] z-[70] grid w-[178px] gap-0.5 rounded-[14px] border border-[#E7E4EC] bg-white/[.98] p-[7px] shadow-[0_22px_60px_-26px_rgba(24,14,38,.38)] backdrop-blur-[18px] transition",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        {languageLinks.map((lang) => (
          <a
            key={lang.code}
            className="flex min-h-10 items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-[#4A4650] transition hover:bg-[#F7F2FF] hover:text-[#0B0B0F]"
            href={lang.href}
            hrefLang={localeLanguageTag(lang.code)}
            lang={localeLanguageTag(lang.code)}
            aria-current={props.locale === lang.code ? "page" : undefined}
            onClick={() => handleLanguageClick(lang.code)}
          >
            <span>{lang.label}</span>
            <Check
              className={cn(
                "ml-auto size-4",
                props.locale !== lang.code && "invisible",
              )}
              aria-hidden="true"
            />
          </a>
        ))}
      </nav>
    </div>
  );
}

export function SiteHeader(props: Props) {
  const copy = getCopy(props.locale);
  const cliCopy = cliLandingCopy[props.locale] ?? cliLandingCopy.en;
  const toolsCopy = toolsLandingCopy[props.locale];
  const { docsUrl } = useSiteConfig();
  const legacyLabels =
    legacyNavLabelByLocale[props.locale] ?? legacyNavLabelByLocale.en;
  const groupLabels =
    navGroupLabelByLocale[props.locale] ?? navGroupLabelByLocale.en;
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuId = useId();
  const [consoleSessionActive, setConsoleSessionActive] = useState(false);
  const currentPath = stripLocale(props.pathname);
  const signInHref = consoleSignInUrl(props.locale);
  const signUpHref = consoleUrl("/sign-up", `lng=${props.locale}`);
  const dashboardHref = consoleUrl("/dashboard");
  const accountHref = consoleSessionActive ? dashboardHref : signInHref;
  const accountLabel = consoleSessionActive ? copy.nav.console : copy.nav.signIn;
  const startFreeLabel =
    startFreeLabelByLocale[props.locale] ?? startFreeLabelByLocale.en;
  const primaryActionHref = consoleSessionActive ? dashboardHref : signUpHref;
  const primaryActionLabel = consoleSessionActive
    ? copy.nav.console
    : startFreeLabel;

  const productItems = useMemo<NavItem[]>(
    () => [
      { href: "/models", label: copy.nav.modelPricing, publicPath: true },
      { href: TOOLS_LANDING_PATH, label: toolsCopy.navLabel, publicPath: true },
      { href: "/playground", label: legacyLabels.playground, publicPath: true },
      { href: "/compute", label: legacyLabels.compute, publicPath: true },
    ],
    [copy.nav.modelPricing, legacyLabels, toolsCopy.navLabel],
  );
  const resourceItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/blog",
        label: props.locale === "en" ? "Blogs" : copy.nav.blog,
        publicPath: true,
      },
      {
        href: "/rankings",
        label: props.locale === "en" ? "Ranking" : copy.nav.rankings,
        publicPath: true,
      },
      ...(docsUrl
        ? [
            {
              external: true,
              href: docsUrl,
              label: copy.nav.docs,
            },
          ]
        : []),
      { href: "/usecases", label: legacyLabels.usecases, publicPath: true },
      { href: "/status", label: legacyLabels.status, publicPath: true },
    ],
    [
      copy.nav.blog,
      copy.nav.docs,
      copy.nav.rankings,
      docsUrl,
      legacyLabels.status,
      legacyLabels.usecases,
      props.locale,
    ],
  );
  const topLevelItems = [
    { href: CLI_LANDING_PATH, label: cliCopy.navLabel, publicPath: true },
    { href: "/pricing", label: copy.nav.pricing, publicPath: true },
  ];

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    let cancelled = false;

    const applyHint = () => {
      setConsoleSessionActive(hasConsoleSessionHint());
    };
    const refresh = async () => {
      try {
        const response = await fetch("/api/mixpanel/current-user", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          clearConsoleSessionHint();
          setConsoleSessionActive(false);
          return;
        }
        if (!response.ok) return;

        const payload: unknown = await response.json();
        const verified = isVerifiedConsoleUserPayload(payload);
        if (verified) {
          rememberConsoleSessionHint();
        } else {
          clearConsoleSessionHint();
        }
        setConsoleSessionActive(verified);
      } catch {
        /* Keep the local hint when a transient network failure prevents verification. */
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    applyHint();
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const renderNavLink = (item: NavItem, compact = false, withDot = false) => {
    const hrefPath = item.href.split("#")[0] || item.href;
    const active =
      item.publicPath && currentPath === hrefPath && !item.href.includes("#");
    const className = cn(
      compact
        ? "flex min-h-10 items-center rounded-[10px] px-3 py-2 text-sm font-semibold transition hover:bg-[#F7F2FF] hover:text-[#0B0B0F]"
        : desktopNavTriggerClass,
      active ? desktopNavActiveClass : "text-[#4A4650]",
    );
    const children = (
      <>
        {withDot ? (
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              active ? "bg-[#7C3AED]" : "bg-[#AAA7B0]",
            )}
            aria-hidden="true"
          />
        ) : null}
        <span className="min-w-0 overflow-hidden text-ellipsis">
          {item.label}
        </span>
      </>
    );

    return item.external ? (
      <a
        key={item.href}
        className={className}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ) : (
      <Link
        key={item.href}
        className={className}
        href={
          item.publicPath ? localizePath(item.href, props.locale) : item.href
        }
        onClick={() => setMobileOpen(false)}
      >
        {children}
      </Link>
    );
  };

  const renderMobileNavLink = (item: NavItem) => {
    const hrefPath = item.href.split("#")[0] || item.href;
    const active =
      item.publicPath && currentPath === hrefPath && !item.href.includes("#");
    const className = cn(mobileNavRowClass, active && mobileNavActiveClass);

    return item.external ? (
      <a
        key={item.href}
        className={className}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.label}
      </a>
    ) : (
      <Link
        key={item.href}
        className={className}
        href={
          item.publicPath ? localizePath(item.href, props.locale) : item.href
        }
        onClick={() => setMobileOpen(false)}
      >
        {item.label}
      </Link>
    );
  };

  const renderNavGroup = (label: string, items: NavItem[]) => (
    <div className="group/nav relative">
      <div
        className={cn(
          desktopNavTriggerClass,
          "cursor-default select-none group-hover/nav:bg-[#F7F2FF] group-hover/nav:text-[#0B0B0F]",
        )}
      >
        <span
          className={desktopNavDotClass}
          aria-hidden="true"
        />
        <span className="min-w-0 overflow-hidden text-ellipsis">{label}</span>
      </div>
      <div className="pointer-events-none absolute top-full left-1/2 z-[70] w-[220px] -translate-x-1/2 translate-y-1 pt-[10px] opacity-0 transition group-hover/nav:pointer-events-auto group-hover/nav:translate-y-0 group-hover/nav:opacity-100">
        <div className="grid gap-0.5 rounded-[14px] border border-[#E7E4EC] bg-white/[.98] p-[7px] shadow-[0_22px_60px_-26px_rgba(24,14,38,.38)] backdrop-blur-[18px]">
          {items.map((item) => (
            <div key={item.href}>{renderNavLink(item, true)}</div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMobileGroup = (label: string, items: NavItem[]) => (
    <details className="group">
      <summary
        className={cn(
          mobileNavRowClass,
          mobileNavOpenClass,
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {label}
        </span>
        <ChevronDown
          className="ml-auto size-4 shrink-0 text-[#8D8994] transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className={mobileNavNestedClass}>
        {items.map((item) => renderMobileNavLink(item))}
      </div>
    </details>
  );

  return (
    <header className="fk-site-header sticky top-0 z-50 border-b border-[#E7E4EC] bg-white/95 backdrop-blur-[8px]">
      <nav className="relative mx-auto flex h-[72px] max-w-[var(--fk-site-frame-max-width)] items-center gap-3 px-[var(--fk-site-gutter)] text-[#0B0B0F] min-[901px]:h-[76px] min-[1180px]:h-[84px] min-[1180px]:gap-5 min-[1480px]:h-[88px] min-[1480px]:gap-[30px]">
        <Link
          href={localizePath("/", props.locale)}
          className="inline-flex shrink-0 items-center no-underline"
        >
          <FlatkeyBrandLogo className={headerLogoClass} />
          <span className="sr-only">flatkey.ai</span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-0 min-[901px]:flex min-[1120px]:gap-0.5">
          {renderNavGroup(groupLabels.products, productItems)}
          {renderNavGroup(groupLabels.resources, resourceItems)}
          {topLevelItems.map((item) => renderNavLink(item, false, true))}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-1.5 min-[901px]:flex min-[1180px]:gap-2">
          {!props.hideLanguageSwitcher && (
            <HeaderLanguageMenu
              locale={props.locale}
              pathname={props.pathname}
              cookieDomain={props.languageCookieDomain}
            />
          )}
          <a
            className={desktopSecondaryActionClass}
            href={accountHref}
            aria-label={accountLabel}
          >
            <span>{accountLabel}</span>
          </a>
          {!consoleSessionActive && (
            <a
              className={desktopPrimaryActionClass}
              href={signUpHref}
              style={{ color: "#fff" }}
            >
              {startFreeLabel}
            </a>
          )}
        </div>

        <a
          className="ml-auto inline-flex h-10 max-w-[8.5rem] shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-[9px] bg-[#070707] px-3 text-[13px] font-bold text-ellipsis text-white no-underline shadow-[0_6px_18px_-12px_rgba(11,11,15,.8)] min-[901px]:hidden"
          href={primaryActionHref}
          style={{ color: "#fff" }}
        >
          {primaryActionLabel}
        </a>
        <button
          type="button"
          className={cn(
            mobileMenuButtonClass,
            mobileOpen && mobileMenuButtonOpenClass,
          )}
          aria-label={copy.nav.toggle}
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
          onClick={() => setMobileOpen((value) => !value)}
        >
          <span
            className={cn(
              "inline-flex size-5 items-center justify-center transition-transform duration-200 ease-out",
              mobileOpen && "scale-105 rotate-90",
            )}
            aria-hidden="true"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </span>
        </button>
      </nav>

      <div
        id={mobileMenuId}
        className={cn(
          "fixed inset-x-0 top-[72px] z-40 max-h-[calc(100dvh-72px)] overflow-y-auto border-b border-[#E7E4EC] bg-white px-4 py-4 shadow-[0_22px_60px_-42px_rgba(11,11,15,.45)] transition duration-200 ease-out min-[901px]:hidden",
          mobileOpen
            ? "translate-y-0 opacity-100 shadow-[0_24px_70px_-42px_rgba(76,29,149,.52)]"
            : "pointer-events-none -translate-y-4 opacity-0 shadow-none",
        )}
      >
        <div className="mb-3 grid">
          <a
            className="flex min-h-12 items-center justify-center rounded-xl border border-[#0B0B0F14] bg-white px-4 py-3 text-base font-bold text-[#0B0B0F] shadow-[0_10px_24px_-22px_rgba(11,11,15,.55)] transition hover:border-[#C9B8FF] hover:bg-[#F3EDFF] hover:text-[#6B46C1] focus-visible:border-[#C9B8FF] focus-visible:bg-[#F3EDFF] focus-visible:text-[#6B46C1] focus-visible:outline-none"
            href={accountHref}
            aria-label={accountLabel}
          >
            <span>{accountLabel}</span>
          </a>
        </div>
        <div className={mobileMenuSurfaceClass}>
          {renderMobileGroup(groupLabels.products, productItems)}
          {renderMobileGroup(groupLabels.resources, resourceItems)}
          {topLevelItems.map((item) => renderMobileNavLink(item))}
          {!props.hideLanguageSwitcher && (
            <HeaderLanguageMenu
              locale={props.locale}
              pathname={props.pathname}
              cookieDomain={props.languageCookieDomain}
              variant="panel"
            />
          )}
        </div>
      </div>
    </header>
  );
}
