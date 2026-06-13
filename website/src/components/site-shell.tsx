import Link from "next/link";
import type { ReactNode } from "react";
import { getCopy } from "@/lib/copy";
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, type Locale, localizePath } from "@/lib/locales";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flatkey.ai/dashboard";

type Props = {
  locale: Locale;
  pathname: string;
  children: ReactNode;
};

export function SiteShell(props: Props) {
  const copy = getCopy(props.locale);
  const navItems = [
    { href: "/pricing", label: copy.nav.pricing },
    { href: "/rankings", label: copy.nav.rankings },
    { href: "/blog", label: copy.nav.blog },
    { href: "/about", label: copy.nav.about },
  ];

  return (
    <>
      <header className="site-header">
        <Link className="brand" href={localizePath("/", props.locale)}>
          flatkey.ai
        </Link>
        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={localizePath(item.href, props.locale)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="language-nav" aria-label="Language navigation">
          {LOCALES.map((locale) => (
            <a key={locale} href={localizePath(props.pathname, locale)} hrefLang={locale}>
              {locale === DEFAULT_LOCALE ? "EN" : LOCALE_LABELS[locale]}
            </a>
          ))}
        </nav>
        <a className="app-link" href={APP_URL}>
          {copy.nav.app}
        </a>
      </header>
      <main>{props.children}</main>
      <footer className="site-footer">
        <span>© 2026 flatkey.ai</span>
        <Link href={localizePath("/terms", props.locale)}>Terms</Link>
        <Link href={localizePath("/privacy", props.locale)}>Privacy</Link>
        <Link href={localizePath("/sla", props.locale)}>SLA</Link>
      </footer>
    </>
  );
}
