import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCopy } from "@/lib/copy";
import { type Locale, localizePath } from "@/lib/locales";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flatkey.ai/dashboard";

type Props = {
  locale: Locale;
  pathname: string;
  children: ReactNode;
};

export function SiteShell(props: Props) {
  const copy = getCopy(props.locale);
  const navItems = [{ href: "/blog", label: copy.nav.blog }];

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
        <div className="pointer-events-auto mx-auto max-w-7xl px-4 pt-0 md:px-6">
          <nav className="flex h-16 items-center justify-between px-2">
            <Link className="group flex shrink-0 items-center gap-2.5" href={localizePath("/", props.locale)}>
              <span className="flex h-11 items-center text-lg font-bold tracking-tight text-foreground">
                flatkey.ai
              </span>
            </Link>
            <div className="hidden items-center gap-0.5 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200"
                  href={localizePath(item.href, props.locale)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher locale={props.locale} pathname={props.pathname} />
              <a
                className="inline-flex h-9 items-center justify-center rounded-lg bg-violet-600 px-3.5 text-[13px] font-medium text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-colors hover:bg-violet-500"
                href={APP_URL}
              >
                {copy.nav.app}
              </a>
            </div>
          </nav>
        </div>
      </header>
      <main>{props.children}</main>
      <footer className="relative z-10 border-t border-violet-500/10 bg-white/45 px-6 py-10 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-sm text-muted-foreground md:flex-row">
          <span>© 2026 flatkey.ai</span>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link className="hover:text-foreground transition-colors" href={localizePath("/terms", props.locale)}>
              Terms
            </Link>
            <Link className="hover:text-foreground transition-colors" href={localizePath("/privacy", props.locale)}>
              Privacy
            </Link>
            <Link className="hover:text-foreground transition-colors" href={localizePath("/sla", props.locale)}>
              SLA
            </Link>
            <a className="hover:text-foreground transition-colors" href="mailto:support@flatkey.ai">
              Support: support@flatkey.ai
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
