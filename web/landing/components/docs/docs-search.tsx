"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";

import type { DocSummary } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

interface DocsSearchProps {
  documents: DocSummary[];
  className?: string;
  onNavigate?: () => void;
}

export function DocsSearch({ documents, className, onNavigate }: DocsSearchProps) {
  const searchId = useId();
  const resultsId = `${searchId}-results`;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    return documents
      .filter((document) =>
        `${document.title} ${document.description ?? ""}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [documents, normalizedQuery]);
  const resultStatus = normalizedQuery
    ? results.length > 0
      ? `找到 ${results.length} 篇相关文档。`
      : "没有找到相关文档。"
    : "";

  return (
    <div className={cn("relative", className)}>
      <label className="sr-only" htmlFor={searchId}>
        搜索文档
      </label>
      <IconSearch
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
      />
      <input
        id={searchId}
        name="docs-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery("");
        }}
        placeholder="搜索文档…"
        autoComplete="off"
        className="h-9 w-full rounded-xl border border-black/10 bg-neutral-50 pr-3 pl-9 font-medium text-neutral-950 outline-none placeholder:text-neutral-400 focus-visible:border-blue-600/40 focus-visible:ring-3 focus-visible:ring-blue-600/10 [font-size:var(--docs-text-sm)]"
      />
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {resultStatus}
      </p>

      {normalizedQuery && (
        <div
          id={resultsId}
          className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
        >
          {results.length > 0 ? (
            <ul>
              {results.map((document) => (
                <li key={document.href}>
                  <Link
                    href={document.href}
                    onClick={() => {
                      setQuery("");
                      onNavigate?.();
                    }}
                    className="block rounded-xl px-3 py-2.5 outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
                  >
                    <span className="block font-semibold text-neutral-950 [font-size:var(--docs-text-sm)]">
                      {document.title}
                    </span>
                    {document.description && (
                      <span className="mt-0.5 block line-clamp-1 text-neutral-500 [font-size:var(--docs-text-xs)]">
                        {document.description}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center font-medium text-neutral-500 [font-size:var(--docs-text-sm)]">
              没有找到相关文档
            </p>
          )}
        </div>
      )}
    </div>
  );
}
