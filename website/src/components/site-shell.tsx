import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/lib/locales";

type Props = {
  locale: Locale;
  pathname: string;
  children: ReactNode;
};

export function SiteShell(props: Props) {
  const languageCookieDomain = process.env.COOKIE_SESSION_DOMAIN?.trim() || undefined;

  return (
    <>
      <SiteHeader
        locale={props.locale}
        pathname={props.pathname}
        languageCookieDomain={languageCookieDomain}
      />
      <main>{props.children}</main>
      <SiteFooter locale={props.locale} />
    </>
  );
}
