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
      <main className="home-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70"
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
          {content.sections.map((section) => (
            <article
              key={section.title}
              className="min-h-[210px] rounded-xl border border-violet-500/15 bg-white/80 p-7 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm md:p-8"
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
