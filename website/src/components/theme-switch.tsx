"use client";

import { Check, Moon, Sun } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const THEME_COOKIE_NAME = "vite-ui-theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type Props = {
  locale: Locale;
};

function getCookieTheme(): Theme {
  if (typeof document === "undefined") return "system";
  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${THEME_COOKIE_NAME}=`));
  const value = match?.split("=")[1] as Theme | undefined;
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  document.querySelector("meta[name='theme-color']")?.setAttribute("content", resolved === "dark" ? "#020817" : "#fff");
}

export function ThemeSwitch({ locale }: Props) {
  const copy = getCopy(locale);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () =>
      [
        { code: "light" as const, label: copy.nav.light },
        { code: "dark" as const, label: copy.nav.dark },
        { code: "system" as const, label: copy.nav.system },
      ],
    [copy.nav.dark, copy.nav.light, copy.nav.system]
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      const cookieTheme = getCookieTheme();
      setTheme(cookieTheme);
      applyTheme(cookieTheme);
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
  }, [mounted, theme]);

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

  const resolved = mounted ? resolveTheme(theme) : "light";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium text-muted-foreground transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-foreground/10 aria-expanded:bg-muted aria-expanded:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
        aria-label={copy.nav.toggleTheme}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Sun
          className={cn(
            "size-[1.2rem] transition-all",
            resolved === "dark" ? "scale-0 -rotate-90" : "scale-100 rotate-0"
          )}
          aria-hidden="true"
        />
        <Moon
          className={cn(
            "absolute size-[1.2rem] transition-all",
            resolved === "dark" ? "scale-100 rotate-0" : "scale-0 rotate-90"
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={menuId}
        role="menu"
        className={cn(
          "absolute right-0 top-[calc(100%+0.25rem)] z-50 min-w-32 origin-top-right overflow-hidden rounded-lg bg-background p-1 text-sm shadow-md ring-1 ring-foreground/10 transition-all duration-100",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        )}
      >
        {options.map((option) => (
          <button
            key={option.code}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              setTheme(option.code);
              setOpen(false);
            }}
          >
            <span>{option.label}</span>
            <Check
              size={14}
              className={cn("ms-auto", (!mounted || theme !== option.code) && "invisible")}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
