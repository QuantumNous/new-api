import Image from "next/image";
import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";

import { docsConfig } from "@/app/docs/docs.config";
import { DocsSearch } from "@/components/docs/docs-search";
import { MobileDocsNavigation } from "@/components/docs/mobile-docs-navigation";
import type { DocsNavigationSection } from "@/lib/docs/types";

export function DocsHeader({ navigation }: { navigation: DocsNavigationSection[] }) {
  const documents = navigation.flatMap((section) => section.documents);
  const { navbar } = docsConfig;

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-black/[0.06] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MobileDocsNavigation navigation={navigation} />
          <Link
            href={navbar.homeHref}
            className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
          >
            <Image
              src={navbar.icon}
              width={24}
              height={24}
              alt=""
              unoptimized
              className="size-5 shrink-0"
            />
            <span className="hidden font-bold tracking-[-0.025em] text-neutral-950 sm:inline [font-size:var(--docs-text-h6)]">
              {navbar.siteName}
            </span>
            <span className="hidden font-medium text-neutral-400 md:inline [font-size:var(--docs-text-sm)]">
              {navbar.sectionName}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <DocsSearch documents={documents} className="hidden w-64 lg:block xl:w-72" />
          <nav aria-label="站点链接" className="flex items-center gap-2">
            {navbar.links.map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                className={
                  link.console
                    ? "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl bg-blue-600 px-4 font-semibold text-white outline-none transition-colors hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/30 [font-size:var(--docs-text-sm)]"
                    : "inline-flex h-9 shrink-0 items-center rounded-2xl px-3 font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-3 focus-visible:ring-blue-600/20 [font-size:var(--docs-text-sm)]"
                }
              >
                {link.label}
                {link.console && <IconArrowUpRight aria-hidden="true" className="size-4" />}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
