"use client";

import { buildLanguagePreferenceCookie } from "@/lib/language-routing";
import { LOCALE_LABELS, LOCALES, type Locale, localizePath, stripLocale } from "@/lib/locales";

type Props = {
  locale: Locale;
  pathname: string;
};

export function OnlineLanguageSelect(props: Props) {
  return (
    <select
      className="langsel"
      aria-label="Change language"
      value={props.locale}
      onChange={(event) => {
        const nextLocale = event.currentTarget.value as Locale;
        document.cookie = buildLanguagePreferenceCookie(nextLocale);
        window.location.href = localizePath(stripLocale(props.pathname), nextLocale);
      }}
    >
      {LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_LABELS[locale]}
        </option>
      ))}
    </select>
  );
}
