import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/lib/locales";

type Props = {
  locale: Locale;
  pathname: string;
  /** Use the static homepage's desktop navigation threshold on paid-search pages. */
  expandNavigationAtTablet?: boolean;
  /** Single-locale routes (market pages) have no localized siblings — the switcher would link to 404s. */
  hideLanguageSwitcher?: boolean;
  languageSwitcherLocales?: readonly Locale[];
  children: ReactNode;
};

export function SiteShell(props: Props) {
  const languageCookieDomain =
    process.env.COOKIE_SESSION_DOMAIN?.trim() || undefined;

  return (
    <>
      <SiteHeader
        locale={props.locale}
        pathname={props.pathname}
        languageCookieDomain={languageCookieDomain}
        expandNavigationAtTablet={props.expandNavigationAtTablet}
        hideLanguageSwitcher={props.hideLanguageSwitcher}
        languageSwitcherLocales={props.languageSwitcherLocales}
      />
      <div className="fk-site-main fk-new-home" data-route={props.pathname}>
        {props.children}
      </div>
      <SiteFooter locale={props.locale} />
    </>
  );
}
