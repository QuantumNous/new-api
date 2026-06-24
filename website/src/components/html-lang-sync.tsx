"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { resolveLocaleFromPathname } from "@/lib/locales";

export function HtmlLangSync() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = resolveLocaleFromPathname(pathname);
  }, [pathname]);

  return null;
}
