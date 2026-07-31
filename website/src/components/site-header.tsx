"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { LANGUAGE_PREFERENCE_COOKIE } from "@/lib/language-routing";
import { CLI_LANDING_PATH, cliLandingCopy } from "@/lib/cli-landing";
import { getCopy } from "@/lib/copy";
import { LOCALE_LABELS, LOCALES, type Locale, localeLanguageTag, localizePath, stripLocale, withIdFallback } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";
import { TOOLS_LANDING_PATH, toolsLandingCopy } from "@/lib/tools-landing";
import { cn } from "@/lib/utils";

const legacyNavLabelByLocale: Record<
  Locale,
  {
    compute: string;
    playground: string;
    status: string;
    usecases: string;
  }
> = withIdFallback({
  en: { compute: "Compute", playground: "Playground", status: "Status", usecases: "Use cases" },
  zh: { compute: "算力", playground: "Playground", status: "服务状态", usecases: "使用场景" },
  es: { compute: "Compute", playground: "Playground", status: "Estado", usecases: "Casos de uso" },
  fr: { compute: "Compute", playground: "Playground", status: "Statut", usecases: "Cas d'usage" },
  pt: { compute: "Compute", playground: "Playground", status: "Status", usecases: "Casos de uso" },
  ru: { compute: "Compute", playground: "Playground", status: "Статус", usecases: "Сценарии" },
  ja: { compute: "Compute", playground: "Playground", status: "ステータス", usecases: "ユースケース" },
  vi: { compute: "Compute", playground: "Playground", status: "Trạng thái", usecases: "Use cases" },
  de: { compute: "Compute", playground: "Playground", status: "Status", usecases: "Anwendungsfälle" },
});

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

const navGroupLabelByLocale: Record<Locale, { careers: string; developers: string; products: string; resources: string }> = withIdFallback({
  en: { products: "Products", developers: "Developers", resources: "Resources", careers: "Careers" },
  zh: { products: "产品", developers: "开发者", resources: "资源", careers: "加入我们" },
  es: { products: "Productos", developers: "Desarrolladores", resources: "Recursos", careers: "Carreras" },
  fr: { products: "Produits", developers: "Développeurs", resources: "Ressources", careers: "Carrières" },
  pt: { products: "Produtos", developers: "Desenvolvedores", resources: "Recursos", careers: "Carreiras" },
  ru: { products: "Продукты", developers: "Разработчикам", resources: "Ресурсы", careers: "Вакансии" },
  ja: { products: "プロダクト", developers: "開発者向け", resources: "リソース", careers: "採用情報" },
  vi: { products: "Sản phẩm", developers: "Nhà phát triển", resources: "Tài nguyên", careers: "Tuyển dụng" },
  de: { products: "Produkte", developers: "Entwickler", resources: "Ressourcen", careers: "Karriere" },
});

type Props = {
  locale: Locale;
  pathname: string;
  languageCookieDomain?: string;
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
  const cliCopy = cliLandingCopy[props.locale] ?? cliLandingCopy.en;
  const toolsCopy = toolsLandingCopy[props.locale];
  const legacyLabels = legacyNavLabelByLocale[props.locale] ?? legacyNavLabelByLocale.en;
  const groupLabels = navGroupLabelByLocale[props.locale] ?? navGroupLabelByLocale.en;
  const startFreeLabel = startFreeLabelByLocale[props.locale] ?? startFreeLabelByLocale.en;
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = stripLocale(props.pathname);
  const signInHref = consoleUrl("/sign-in", `lng=${props.locale}`);
  const signUpHref = consoleUrl("/sign-up", `lng=${props.locale}`);
  const showContactAction = currentPath !== "/contact";

  const productItems = useMemo<NavItem[]>(
    () => [
      { href: "/models", label: copy.nav.modelPricing, publicPath: true },
      { href: TOOLS_LANDING_PATH, label: toolsCopy.navLabel, publicPath: true },
      { href: "/playground", label: legacyLabels.playground, publicPath: true },
      { href: "/rankings", label: copy.nav.rankings, publicPath: true },
      { href: "/compute", label: legacyLabels.compute, publicPath: true },
      { href: "/usecases", label: legacyLabels.usecases, publicPath: true },
    ],
    [copy.nav.modelPricing, copy.nav.rankings, legacyLabels, toolsCopy.navLabel]
  );
  const developerItems = useMemo<NavItem[]>(
    () => [
      { href: CLI_LANDING_PATH, label: cliCopy.navLabel, publicPath: true },
      { href: "/docs", label: copy.nav.docs, publicPath: true },
      { href: "/status", label: legacyLabels.status, publicPath: true },
    ],
    [cliCopy.navLabel, copy.nav.docs, legacyLabels.status]
  );
  const resourceItems = useMemo<NavItem[]>(
    () => [
      { href: "/blog", label: copy.nav.blog, publicPath: true },
      { href: "/about", label: copy.nav.about, publicPath: true },
      { href: "/careers", label: groupLabels.careers, publicPath: true },
      { href: "/contact", label: copy.nav.contact, publicPath: true },
    ],
    [copy.nav.about, copy.nav.blog, copy.nav.contact, groupLabels.careers]
  );
  const mobileItems = [...productItems, ...developerItems, ...resourceItems, { href: "/pricing", label: copy.nav.pricing, publicPath: true }];

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const renderNavLink = (item: NavItem, compact = false) => {
    const active = item.publicPath && currentPath === item.href;
    const className = cn(
      compact
        ? "block rounded-lg px-3 py-2.5 text-base font-semibold"
        : "inline-flex h-9 items-center whitespace-nowrap text-[13px] font-semibold",
      active ? "text-[#0B0B0F]" : "text-[#43434C] hover:text-[#0B0B0F]"
    );

    return item.external ? (
      <a key={item.href} className={className} href={item.href} target="_blank" rel="noopener noreferrer">
        {item.label}
      </a>
    ) : (
      <Link key={item.href} className={className} href={item.publicPath ? localizePath(item.href, props.locale) : item.href} onClick={() => setMobileOpen(false)}>
        {item.label}
      </Link>
    );
  };

  const renderNavGroup = (label: string, items: NavItem[]) => (
    <div className="group/nav relative">
      <button
        type="button"
        className="inline-flex h-9 items-center whitespace-nowrap text-[13px] font-semibold text-[#43434C] hover:text-[#0B0B0F]"
        aria-haspopup="menu"
      >
        {label}
      </button>
      <div className="pointer-events-none absolute top-full left-0 z-50 pt-3 opacity-0 transition-opacity group-hover/nav:pointer-events-auto group-hover/nav:opacity-100 group-focus-within/nav:pointer-events-auto group-focus-within/nav:opacity-100">
        <div className="min-w-52 rounded-xl border border-[#0B0B0F14] bg-white p-2 shadow-[0_22px_70px_-45px_rgba(11,11,15,.48)]">
          {items.map((item) => (
            <div key={item.href}>{renderNavLink(item, true)}</div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#0B0B0F14] bg-white/95 backdrop-blur-md">
      <nav className="flex h-[76px] items-center gap-4 px-5 text-[#0B0B0F] min-[1180px]:gap-[18px] min-[1320px]:px-8">
        <Link href={localizePath("/", props.locale)} className="mr-1 inline-flex shrink-0 items-center">
          <FlatkeyBrandLogo className="[&_[data-flatkey-wordmark='true']]:text-[30px] [&_img]:h-10 [&_img]:w-10 min-[1480px]:[&_[data-flatkey-wordmark='true']]:text-[32px] min-[1480px]:[&_img]:h-11 min-[1480px]:[&_img]:w-11" />
          <span className="sr-only">flatkey.ai</span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-4 min-[1180px]:flex min-[1480px]:gap-[18px]">
          <span className="text-[#aaa7b0]">•</span>
          {renderNavGroup(groupLabels.products, productItems)}
          <span className="text-[#aaa7b0]">•</span>
          {renderNavGroup(groupLabels.developers, developerItems)}
          <span className="text-[#aaa7b0]">•</span>
          {renderNavGroup(groupLabels.resources, resourceItems)}
          <Link
            className={cn(
              "inline-flex h-9 items-center whitespace-nowrap text-[13px] font-semibold",
              currentPath === "/pricing" ? "text-[#0B0B0F]" : "text-[#43434C] hover:text-[#0B0B0F]"
            )}
            href={localizePath("/pricing", props.locale)}
          >
            {copy.nav.pricing}
          </Link>
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 min-[1180px]:flex">
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
          className="ml-auto inline-flex size-[42px] items-center justify-center rounded-[10px] border border-[#0B0B0F14] bg-white text-[#0B0B0F] min-[1180px]:hidden"
          aria-label={copy.nav.toggle}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-x-0 top-[76px] z-40 border-b border-[#0B0B0F14] bg-white px-5 py-4 shadow-[0_22px_60px_-42px_rgba(11,11,15,.45)] transition min-[1180px]:hidden",
          mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        )}
      >
        <div className="grid gap-1">{mobileItems.map((item) => renderNavLink(item, true))}</div>
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
