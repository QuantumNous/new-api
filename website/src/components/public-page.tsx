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
  return (
    <SiteShell locale={props.locale} pathname={props.pathname}>
      <section className="page-hero">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </section>
      <section className="content-list">
        {content.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
