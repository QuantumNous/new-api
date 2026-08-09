import Link from "next/link";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

import type { DocSummary } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

export function DocumentPagination({
  previous,
  next,
}: {
  previous?: DocSummary;
  next?: DocSummary;
}) {
  if (!previous && !next) return null;

  return (
    <nav aria-label="文档翻页" className="mt-16 grid gap-4 sm:grid-cols-2">
      {previous ? (
        <Link
          href={previous.href}
          className="group relative overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-4 text-left outline-none transition-[border-color,background-color] duration-200 hover:border-blue-600/20 hover:bg-blue-50/30 focus-visible:ring-3 focus-visible:ring-blue-600/20"
        >
          <span className="flex items-center gap-1.5 font-medium text-neutral-500 transition-colors duration-200 group-hover:text-blue-600 group-focus-visible:text-blue-600 [font-size:var(--docs-text-xs)]">
            <span className="relative size-4 overflow-hidden" aria-hidden="true">
              <IconArrowLeft className="absolute inset-0 size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-full group-focus-visible:-translate-x-full" />
              <IconArrowLeft className="absolute inset-0 size-4 translate-x-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-focus-visible:translate-x-0" />
            </span>
            上一篇
          </span>
          <span className="mt-1.5 block font-semibold text-neutral-800 transition-[color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-0.5 group-hover:text-blue-600 group-focus-visible:-translate-x-0.5 group-focus-visible:text-blue-600 [font-size:var(--docs-text-sm)]">
            {previous.title}
          </span>
        </Link>
      ) : null}

      {next && (
        <Link
          href={next.href}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-4 text-right outline-none transition-[border-color,background-color] duration-200 hover:border-blue-600/20 hover:bg-blue-50/30 focus-visible:ring-3 focus-visible:ring-blue-600/20",
            !previous && "sm:col-start-2",
          )}
        >
          <span className="flex items-center justify-end gap-1.5 font-medium text-neutral-500 transition-colors duration-200 group-hover:text-blue-600 group-focus-visible:text-blue-600 [font-size:var(--docs-text-xs)]">
            下一篇
            <span className="relative size-4 overflow-hidden" aria-hidden="true">
              <IconArrowRight className="absolute inset-0 size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full group-focus-visible:translate-x-full" />
              <IconArrowRight className="absolute inset-0 size-4 -translate-x-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-focus-visible:translate-x-0" />
            </span>
          </span>
          <span className="mt-1.5 block font-semibold text-neutral-800 transition-[color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:text-blue-600 group-focus-visible:translate-x-0.5 group-focus-visible:text-blue-600 [font-size:var(--docs-text-sm)]">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
