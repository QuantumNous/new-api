"use client";

import { Check, Languages } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildLanguagePreferenceCookie } from "@/lib/language-routing";
import { LOCALE_LABELS, LOCALES, type Locale, localizePath, stripLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type Props = {
  locale: Locale;
  pathname: string;
  cookieDomain?: string;
};

function persistLanguagePreference(locale: Locale, cookieDomain?: string) {
  document.cookie = buildLanguagePreferenceCookie(locale, cookieDomain);
}

export function LanguageSwitcher(props: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const links = useMemo(() => {
    const strippedPath = stripLocale(props.pathname);
    return LOCALES.map((locale) => ({
      code: locale,
      label: LOCALE_LABELS[locale],
      href: localizePath(strippedPath, locale),
    }));
  }, [props.pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLanguageClick = (locale: Locale) => {
    persistLanguagePreference(locale, props.cookieDomain);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <nav aria-label="Change language" className="sr-only">
        {links.map((lang) => (
          <a
            key={lang.code}
            href={lang.href}
            hrefLang={lang.code}
            aria-current={props.locale === lang.code ? "page" : undefined}
          >
            {lang.label}
          </a>
        ))}
      </nav>

      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium text-muted-foreground transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-foreground/10 aria-expanded:bg-muted aria-expanded:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
        aria-label="Change language"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Languages className="size-[1.2rem]" aria-hidden="true" />
      </button>

      <div
        id={menuId}
        role="menu"
        className={cn(
          "absolute right-0 top-[calc(100%+0.25rem)] z-50 min-w-32 origin-top-right overflow-hidden rounded-lg bg-background p-1 text-sm shadow-md ring-1 ring-foreground/10 transition-all duration-100",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        )}
      >
        {links.map((lang) => (
          <a
            key={lang.code}
            role="menuitem"
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
            href={lang.href}
            hrefLang={lang.code}
            aria-current={props.locale === lang.code ? "page" : undefined}
            onClick={() => handleLanguageClick(lang.code)}
          >
            <span>{lang.label}</span>
            <Check
              size={14}
              className={cn("ms-auto", props.locale !== lang.code && "invisible")}
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
