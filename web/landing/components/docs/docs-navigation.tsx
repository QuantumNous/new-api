"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DocsNavigationSection } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

interface DocsNavigationProps {
  navigation: DocsNavigationSection[];
  onNavigate?: () => void;
}

export function DocsNavigation({ navigation, onNavigate }: DocsNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="文档目录" className="select-none space-y-8 text-left">
      {navigation.map((section) => (
        <div key={section.directory}>
          <p className="mb-2 px-2 font-medium text-neutral-500 [font-size:var(--docs-text-xs)]">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.documents.map((document) => {
              const isActive = pathname === document.href;

              return (
                <li key={document.href}>
                  <Link
                    href={document.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-8 w-full items-center justify-start rounded-lg px-2 py-1.5 leading-snug font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-blue-600/20",
                      isActive && "bg-neutral-100 text-neutral-950",
                      "[font-size:var(--docs-text-sm)]",
                    )}
                  >
                    {document.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
