import { LegalMarkdown, getLegalHeadings } from "@/components/legal-markdown";
import { SiteShell } from "@/components/site-shell";
import { getPageContent, type PublicPageKey } from "@/content/pages";
import type { Locale } from "@/lib/locales";

type Props = {
  locale: Locale;
  pageKey: PublicPageKey;
  pathname: string;
};

export function PublicPage(props: Props) {
  const content = getPageContent(props.pageKey, props.locale);
  const headings = content.document ? getLegalHeadings(content.document) : [];
  const copy = publicPageCopy(props.locale);

  if (content.document) {
    return (
      <SiteShell locale={props.locale} pathname={props.pathname}>
        <main className="public-page relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
          />
          <section className="relative z-10 mx-auto max-w-6xl py-12 md:py-16">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
              {content.eyebrow}
            </p>
            <h1 className="text-foreground max-w-4xl text-3xl leading-tight font-semibold tracking-tight text-balance md:text-5xl">
              {content.title}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-3xl text-base leading-7 text-balance md:text-lg">
              {content.description}
            </p>
            {content.updated ? (
              <p className="text-muted-foreground/70 mt-4 text-xs font-medium tracking-wide uppercase">
                {copy.lastUpdated}: {content.updated}
              </p>
            ) : null}
          </section>
          <section className="relative z-10 mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[minmax(0,1fr)_240px]">
            <article className="rounded-xl border border-violet-500/12 bg-white/72 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.6)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.035] md:p-9">
              <LegalMarkdown markdown={content.document} />
            </article>
            {headings.length > 0 ? (
              <aside className="sticky top-24 hidden text-sm lg:block">
                <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  {copy.tableOfContents}
                </h2>
                <ul className="space-y-1.5">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        className="text-muted-foreground hover:text-foreground block leading-snug transition-colors"
                        href={`#${heading.id}`}
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </section>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell locale={props.locale} pathname={props.pathname}>
      <main className="home-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />
        <section className="relative z-10 mx-auto max-w-6xl py-14 md:py-20">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
            {content.eyebrow}
          </p>
          <h1 className="max-w-4xl text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight">
            {content.title}
          </h1>
          <p className="text-muted-foreground/80 mt-5 max-w-2xl text-base leading-relaxed md:text-[15px]">
            {content.description}
          </p>
        </section>
        <section className="relative z-10 mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {(content.sections ?? []).map((section) => (
            <article
              key={section.title}
              className="min-h-[210px] rounded-xl border border-violet-500/15 bg-white/80 p-7 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.035] md:p-8"
            >
              <h2 className="mb-4 text-xl font-semibold tracking-tight">{section.title}</h2>
              <p className="text-muted-foreground text-sm leading-7 md:text-[15px]">{section.body}</p>
            </article>
          ))}
        </section>
      </main>
    </SiteShell>
  );
}

const PUBLIC_PAGE_COPY: Record<Locale, { lastUpdated: string; tableOfContents: string }> = {
  en: { lastUpdated: "Last updated", tableOfContents: "Table of contents" },
  zh: { lastUpdated: "最后更新", tableOfContents: "目录" },
  es: { lastUpdated: "Última actualización", tableOfContents: "Índice" },
  fr: { lastUpdated: "Dernière mise à jour", tableOfContents: "Sommaire" },
  pt: { lastUpdated: "Última atualização", tableOfContents: "Índice" },
  ru: { lastUpdated: "Последнее обновление", tableOfContents: "Содержание" },
  ja: { lastUpdated: "最終更新", tableOfContents: "目次" },
  vi: { lastUpdated: "Cập nhật lần cuối", tableOfContents: "Mục lục" },
};

function publicPageCopy(locale: Locale) {
  return PUBLIC_PAGE_COPY[locale] ?? PUBLIC_PAGE_COPY.en;
}
