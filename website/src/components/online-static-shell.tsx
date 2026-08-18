import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/lib/locales";

type ShellProps = {
  children: ReactNode;
  hideLanguageSwitcher?: boolean;
  locale: Locale;
  pathname?: string;
};

const ONLINE_STATIC_STYLESHEET_HREF = "/fk2.css?v=731-default-font-scale";
const ONLINE_STATIC_PAGE_CLASS_NAME = "online-static-page";

export function OnlineStaticStylesheet() {
  return (
    <link
      rel="stylesheet"
      href={ONLINE_STATIC_STYLESHEET_HREF}
      data-online-static-stylesheet="true"
    />
  );
}

export function OnlineStaticShell(props: ShellProps) {
  return (
    <>
      <OnlineStaticStylesheet />
      <SiteHeader
        hideLanguageSwitcher={props.hideLanguageSwitcher}
        locale={props.locale}
        pathname={props.pathname ?? "/"}
      />
      <div className={ONLINE_STATIC_PAGE_CLASS_NAME}>{props.children}</div>
      <SiteFooter locale={props.locale} />
    </>
  );
}
