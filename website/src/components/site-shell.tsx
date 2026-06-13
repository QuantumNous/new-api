import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { type Locale, localizePath } from "@/lib/locales";

type Props = {
  locale: Locale;
  pathname: string;
  children: ReactNode;
};

export function SiteShell(props: Props) {
  return (
    <>
      <SiteHeader locale={props.locale} pathname={props.pathname} />
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
