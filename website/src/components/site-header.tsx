"use client";

import Image from "next/image";
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

const promoBannerCopyByLocale: Record<
  Locale,
  { dismissLabel: string; linkLabel: string; message: string }
> = withIdFallback({
  en: {
    dismissLabel: "Dismiss DeepSeek V4 announcement",
    linkLabel: "Learn more →",
    message:
      "DeepSeek V4 is here. Join our Discord get $5 free credits.",
  },
  zh: {
    dismissLabel: "关闭 DeepSeek V4 公告",
    linkLabel: "了解更多 →",
    message: "DeepSeek V4 来了。加入我们的 Discord，领取 5 美元免费额度。",
  },
  es: {
    dismissLabel: "Cerrar anuncio de DeepSeek V4",
    linkLabel: "Más información →",
    message:
      "DeepSeek V4 ya está aquí. Únete a nuestro Discord y recibe 5 USD en créditos gratis.",
  },
  fr: {
    dismissLabel: "Fermer l’annonce DeepSeek V4",
    linkLabel: "En savoir plus →",
    message:
      "DeepSeek V4 est arrivé. Rejoignez notre Discord et recevez 5 $ de crédits gratuits.",
  },
  pt: {
    dismissLabel: "Fechar anúncio do DeepSeek V4",
    linkLabel: "Saiba mais →",
    message:
      "O DeepSeek V4 chegou. Entre no nosso Discord e ganhe US$ 5 em créditos grátis.",
  },
  ru: {
    dismissLabel: "Закрыть объявление DeepSeek V4",
    linkLabel: "Узнать больше →",
    message:
      "DeepSeek V4 уже здесь. Присоединяйтесь к нашему Discord и получите 5 $ бесплатных кредитов.",
  },
  ja: {
    dismissLabel: "DeepSeek V4 のお知らせを閉じる",
    linkLabel: "詳細を見る →",
    message:
      "DeepSeek V4 が登場。Discord に参加して、5 ドル分の無料クレジットを獲得しましょう。",
  },
  vi: {
    dismissLabel: "Đóng thông báo DeepSeek V4",
    linkLabel: "Tìm hiểu thêm →",
    message:
      "DeepSeek V4 đã ra mắt. Tham gia Discord của chúng tôi để nhận 5 USD tín dụng miễn phí.",
  },
  de: {
    dismissLabel: "DeepSeek-V4-Ankündigung schließen",
    linkLabel: "Mehr erfahren →",
    message:
      "DeepSeek V4 ist da. Tritt unserem Discord bei und erhalte 5 $ Gratisguthaben.",
  },
  id: {
    dismissLabel: "Tutup pengumuman DeepSeek V4",
    linkLabel: "Pelajari lebih lanjut →",
    message:
      "DeepSeek V4 telah hadir. Bergabunglah dengan Discord kami dan dapatkan kredit gratis senilai US$5.",
  },
});

const PROMO_BANNER_ARTICLE_PATH = "/blog/deepseek-v4-pro-vs-flash";

type Props = {
  locale: Locale;
  pathname: string;
  languageCookieDomain?: string;
  hideLanguageSwitcher?: boolean;
  languageSwitcherLocales?: readonly Locale[];
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
const mobilePrimaryActionClass =
  "flex min-h-12 items-center justify-center rounded-xl bg-[#070707] px-4 py-3 text-base font-bold text-white shadow-[0_14px_30px_-20px_rgba(11,11,15,.8)] transition hover:bg-[#17171B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B8FF] focus-visible:ring-offset-2";
const mobileSecondaryActionClass =
  "flex min-h-12 items-center justify-center rounded-xl border border-[#0B0B0F14] bg-white px-4 py-3 text-base font-bold text-[#0B0B0F] shadow-[0_10px_24px_-22px_rgba(11,11,15,.55)] transition hover:border-[#C9B8FF] hover:bg-[#F3EDFF] hover:text-[#6B46C1] focus-visible:border-[#C9B8FF] focus-visible:bg-[#F3EDFF] focus-visible:text-[#6B46C1] focus-visible:outline-none";
const desktopNavTriggerClass =
  "inline-flex h-10 shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap px-2.5 [font-family:inherit] text-[14px] leading-none no-underline transition-[color,transform,opacity] duration-200 ease-out hover:-translate-y-px hover:text-[#050505] focus-visible:text-[#050505] focus-visible:outline-none active:scale-[0.985] min-[1120px]:gap-1.5 min-[1120px]:px-3 min-[1120px]:text-[14.5px] min-[1360px]:text-[15px]";
const desktopNavDropdownTriggerClass =
  `${desktopNavTriggerClass} cursor-pointer appearance-none border-0 bg-transparent`;
const desktopNavDropdownItemClass =
  "flex min-h-10 origin-center items-center rounded-[10px] px-3 py-2 text-[14px] font-semibold leading-none text-[#0B0B0F] transition-[color,transform,background-color] duration-200 ease-out hover:translate-x-0.5 hover:bg-[#F7F2FF] hover:text-[#050505] focus-visible:bg-[#F7F2FF] focus-visible:text-[#050505] focus-visible:outline-none";
const desktopNavIdleClass = "font-semibold text-[#0B0B0F]";
const desktopNavActiveClass = "font-bold text-[#050505]";
const desktopDropdownChevronClass =
  "size-3 shrink-0 text-current opacity-55 transition-all duration-200 ease-out group-hover/nav:rotate-180 group-hover/nav:opacity-75 group-focus-within/nav:rotate-180 group-focus-within/nav:opacity-75";
const desktopSecondaryActionClass =
  "inline-flex h-10 items-center whitespace-nowrap rounded-[9px] border border-[#E7E4EC] bg-white px-2.5 text-[13px] font-bold text-[#0B0B0F] no-underline shadow-[0_1px_2px_rgba(24,14,38,.05)] transition hover:border-[#D8D1E2] hover:bg-[#F8F4FF] hover:text-[#4C1D95] min-[1180px]:px-3 min-[1180px]:text-[13.5px] min-[1360px]:text-[14px]";
const desktopPrimaryActionClass =
  "inline-flex h-10 max-w-[10rem] items-center justify-center overflow-hidden whitespace-nowrap rounded-[9px] bg-[#070707] px-3 text-[13px] font-bold text-ellipsis text-white no-underline shadow-[0_10px_24px_-18px_rgba(11,11,15,.75)] transition hover:-translate-y-px hover:bg-[#17171B] min-[1180px]:h-11 min-[1180px]:max-w-[12rem] min-[1180px]:px-4 min-[1180px]:text-[13.5px] min-[1360px]:text-[14px]";
const headerLogoClass =
  "gap-2 [&_img]:!h-9 [&_img]:!w-9 [&_[data-flatkey-wordmark='true']]:!text-[28px] min-[1180px]:gap-[9px] min-[1180px]:[&_img]:!h-10 min-[1180px]:[&_img]:!w-10 min-[1180px]:[&_[data-flatkey-wordmark='true']]:!text-[32px] min-[1480px]:[&_img]:!h-11 min-[1480px]:[&_img]:!w-11 min-[1480px]:[&_[data-flatkey-wordmark='true']]:!text-[36px]";

type SiteHeaderDesktopActionsProps = {
  accountHref: string;
  accountLabel: string;
  contactSalesHref: string;
  contactSalesLabel: string;
  consoleSessionActive: boolean;
  signUpHref: string;
  startFreeLabel: string;
};

export function SiteHeaderDesktopActions(
  props: SiteHeaderDesktopActionsProps,
) {
  return (
    <>
      <a
        className={desktopSecondaryActionClass}
        href={props.accountHref}
        aria-label={props.accountLabel}
      >
        <span>{props.accountLabel}</span>
      </a>
      {props.consoleSessionActive ? (
        <a
          className={desktopPrimaryActionClass}
          href={props.contactSalesHref}
          aria-label={props.contactSalesLabel}
          style={{ color: "#fff" }}
        >
          <span>{props.contactSalesLabel}</span>
        </a>
      ) : (
        <a
          className={desktopPrimaryActionClass}
          href={props.signUpHref}
          style={{ color: "#fff" }}
        >
          {props.startFreeLabel}
        </a>
      )}
    </>
  );
}

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
  locales?: readonly Locale[];
  pathname: string;
  variant?: "dropdown" | "panel";
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const strippedPath = stripLocale(props.pathname);
  const locales = props.locales ?? LOCALES;
  const languageLinks = useMemo(
    () =>
      locales.map((locale) => ({
        code: locale,
        href: localizePath(strippedPath, locale),
        label: LOCALE_LABELS[locale],
      })),
    [locales, strippedPath],
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
  const [promoBannerVisible, setPromoBannerVisible] = useState(true);
  const currentPath = stripLocale(props.pathname);
  const signInHref = consoleSignInUrl(props.locale);
  const signUpHref = consoleUrl("/sign-up", `lng=${props.locale}`);
  const dashboardHref = consoleUrl("/dashboard");
  const accountHref = consoleSessionActive ? dashboardHref : signInHref;
  const accountLabel = consoleSessionActive ? copy.nav.console : copy.nav.signIn;
  const contactSalesHref = localizePath("/contact", props.locale);
  const startFreeLabel =
    startFreeLabelByLocale[props.locale] ?? startFreeLabelByLocale.en;
  const primaryActionHref = consoleSessionActive ? dashboardHref : signUpHref;
  const primaryActionLabel = consoleSessionActive
    ? copy.nav.console
    : startFreeLabel;
  const promoBannerCopy =
    promoBannerCopyByLocale[props.locale] ?? promoBannerCopyByLocale.en;
  const promoBannerHref = localizePath(
    PROMO_BANNER_ARTICLE_PATH,
    props.locale,
  );
  const mobileMenuOffsetClass = promoBannerVisible
    ? "top-[132px] max-h-[calc(100dvh-132px)] min-[700px]:top-[112px] min-[700px]:max-h-[calc(100dvh-112px)]"
    : "top-[72px] max-h-[calc(100dvh-72px)]";

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

    const refresh = async () => {
      try {
        const response = await fetch("/api/current-user", {
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
        /* Keep the current verified state when a transient network failure prevents refresh. */
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const renderNavLink = (item: NavItem, compact = false) => {
    const hrefPath = item.href.split("#")[0] || item.href;
    const active =
      item.publicPath && currentPath === hrefPath && !item.href.includes("#");
    const className = cn(
      compact ? desktopNavDropdownItemClass : desktopNavTriggerClass,
      active ? desktopNavActiveClass : desktopNavIdleClass,
    );
    const children = (
      <>
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

  const renderNavGroup = (label: string, items: NavItem[]) => {
    const active = items.some((item) => {
      const hrefPath = item.href.split("#")[0] || item.href;
      return (
        item.publicPath && currentPath === hrefPath && !item.href.includes("#")
      );
    });

    return (
      <div className="group/nav relative before:absolute before:top-full before:left-1/2 before:z-[69] before:h-4 before:w-[256px] before:-translate-x-1/2 before:bg-transparent before:content-['']">
        <button
          type="button"
          aria-haspopup="menu"
          className={cn(
            desktopNavDropdownTriggerClass,
            active ? desktopNavActiveClass : desktopNavIdleClass,
          )}
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className="min-w-0 overflow-hidden text-ellipsis">{label}</span>
          <ChevronDown className={desktopDropdownChevronClass} aria-hidden="true" />
        </button>
        <div className="pointer-events-none absolute top-full left-1/2 z-[70] w-[220px] origin-top -translate-x-1/2 -translate-y-1 scale-[0.97] pt-[6px] opacity-0 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:pointer-events-auto group-hover/nav:translate-y-0 group-hover/nav:scale-100 group-hover/nav:opacity-100 group-focus-within/nav:pointer-events-auto group-focus-within/nav:translate-y-0 group-focus-within/nav:scale-100 group-focus-within/nav:opacity-100">
          <div
            role="menu"
            className="grid gap-0.5 rounded-[14px] border border-[#E7E4EC] bg-white/[.98] p-[7px] shadow-[0_24px_70px_-32px_rgba(24,14,38,.42)] backdrop-blur-[18px]"
          >
            {items.map((item) => (
              <div key={item.href}>{renderNavLink(item, true)}</div>
            ))}
          </div>
        </div>
      </div>
    );
  };

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

  const dismissPromoBanner = () => {
    setPromoBannerVisible(false);
  };

  return (
    <header className="fk-site-header sticky top-0 z-50 border-b border-[#E7E4EC] bg-white/95 backdrop-blur-[8px]">
      {promoBannerVisible && (
        <div className="overflow-hidden border-b border-[#E4DAFF] bg-[#F6F1FF] text-[#0B0B0F]">
          <div className="relative mx-auto flex min-h-[60px] w-full max-w-[100vw] items-center justify-center px-12 py-2 text-center min-[700px]:h-10 min-[700px]:min-h-10 min-[700px]:max-w-[var(--fk-site-frame-max-width)] min-[700px]:px-[var(--fk-site-gutter)] min-[700px]:py-0 min-[700px]:pr-[calc(var(--fk-site-gutter)+2.5rem)]">
            <Link
              className="inline-flex w-[calc(100vw-6rem)] max-w-xs min-w-0 items-center justify-center gap-1.5 text-center text-[#0B0B0F] no-underline min-[430px]:max-w-sm min-[700px]:w-auto min-[700px]:max-w-none min-[700px]:gap-2 min-[700px]:truncate"
              href={promoBannerHref}
            >
              <span
                className="grid size-[18px] shrink-0 place-items-center rounded-full bg-white/85 ring-1 ring-[#E4DAFF] min-[700px]:size-5"
                aria-hidden="true"
              >
                <Image
                  alt=""
                  src="/assets/logos/deepseek.svg"
                  width={16}
                  height={16}
                  unoptimized
                  className="size-[14px] min-[700px]:size-4"
                />
              </span>
              <span className="min-w-0 text-xs leading-snug font-normal min-[700px]:truncate min-[700px]:text-[14px] min-[700px]:leading-tight min-[700px]:font-medium">
                {promoBannerCopy.message}{" "}
                <span className="whitespace-nowrap underline decoration-[#AAA7B0] underline-offset-2">
                  {promoBannerCopy.linkLabel}
                </span>
              </span>
            </Link>
            <button
              type="button"
              className="absolute top-1/2 right-2.5 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#0B0B0F] transition hover:bg-white/75 hover:text-[#0B0B0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B8FF] min-[700px]:right-[max(12px,var(--fk-site-gutter))]"
              aria-label={promoBannerCopy.dismissLabel}
              onClick={dismissPromoBanner}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
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
          {topLevelItems.map((item) => renderNavLink(item))}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-1.5 min-[901px]:flex min-[1180px]:gap-2">
          {!props.hideLanguageSwitcher && (
            <HeaderLanguageMenu
              locale={props.locale}
              locales={props.languageSwitcherLocales}
              pathname={props.pathname}
              cookieDomain={props.languageCookieDomain}
            />
          )}
          <SiteHeaderDesktopActions
            accountHref={accountHref}
            accountLabel={accountLabel}
            contactSalesHref={contactSalesHref}
            contactSalesLabel={copy.nav.contactSales}
            consoleSessionActive={consoleSessionActive}
            signUpHref={signUpHref}
            startFreeLabel={startFreeLabel}
          />
        </div>

        <a
          className={cn(
            "ml-auto h-10 max-w-[8.5rem] shrink-0 overflow-hidden whitespace-nowrap rounded-[9px] px-3 text-[13px] font-bold text-ellipsis no-underline min-[901px]:hidden",
            consoleSessionActive
              ? "inline-flex items-center justify-center border border-[#E7E4EC] bg-white text-[#0B0B0F] shadow-[0_1px_2px_rgba(24,14,38,.05)] transition hover:border-[#D8D1E2] hover:bg-[#F8F4FF] hover:text-[#4C1D95]"
              : "inline-flex items-center justify-center bg-[#070707] text-white shadow-[0_6px_18px_-12px_rgba(11,11,15,.8)]",
          )}
          href={primaryActionHref}
          style={consoleSessionActive ? undefined : { color: "#fff" }}
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
          `fixed inset-x-0 z-40 overflow-y-auto border-b border-[#E7E4EC] bg-white px-4 py-4 shadow-[0_22px_60px_-42px_rgba(11,11,15,.45)] transition duration-200 ease-out min-[901px]:hidden ${mobileMenuOffsetClass}`,
          mobileOpen
            ? "translate-y-0 opacity-100 shadow-[0_24px_70px_-42px_rgba(76,29,149,.52)]"
            : "pointer-events-none -translate-y-4 opacity-0 shadow-none",
        )}
      >
        <div className="mb-3 grid gap-2">
          <a
            className={mobileSecondaryActionClass}
            href={accountHref}
            aria-label={accountLabel}
          >
            <span>{accountLabel}</span>
          </a>
          {consoleSessionActive ? (
            <a
              className={mobilePrimaryActionClass}
              href={contactSalesHref}
              aria-label={copy.nav.contactSales}
              style={{ color: "#fff" }}
            >
              <span>{copy.nav.contactSales}</span>
            </a>
          ) : null}
        </div>
        <div className={mobileMenuSurfaceClass}>
          {renderMobileGroup(groupLabels.products, productItems)}
          {renderMobileGroup(groupLabels.resources, resourceItems)}
          {topLevelItems.map((item) => renderMobileNavLink(item))}
          {!props.hideLanguageSwitcher && (
            <HeaderLanguageMenu
              locale={props.locale}
              locales={props.languageSwitcherLocales}
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
