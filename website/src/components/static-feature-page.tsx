import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { type Locale, localizePath } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";
import { getStaticFeaturePage, type StaticFeaturePageKey } from "@/lib/static-feature-pages";

type Props = {
  pageKey: StaticFeaturePageKey;
  locale: Locale;
};

function primaryHref(pageKey: StaticFeaturePageKey) {
  if (pageKey === "compute" || pageKey === "status" || pageKey === "playground" || pageKey === "docs") return consoleUrl("/dashboard");
  return consoleUrl("/sign-up");
}

function secondaryHref(pageKey: StaticFeaturePageKey, locale: Locale) {
  if (pageKey === "compute" || pageKey === "status" || pageKey === "topup") return localizePath("/contact", locale);
  if (pageKey === "docs" || pageKey === "model") return localizePath("/models", locale);
  if (pageKey === "usecases") return localizePath("/tools", locale);
  return localizePath("/pricing", locale);
}

export function StaticFeaturePage(props: Props) {
  const content = getStaticFeaturePage(props.pageKey, props.locale);

  return (
    <SiteShell locale={props.locale} pathname={content.pathname}>
      <main className="bg-[#FAFAFC] text-[#0B0B0F]">
        <section className="border-b border-[#0B0B0F14] bg-[radial-gradient(900px_360px_at_50%_-90px,#EEE9FF,transparent_70%)] px-5 pt-18 pb-12 md:px-10 md:pt-24 md:pb-16">
          <div className="mx-auto max-w-[1120px] text-center">
            <p className="font-mono text-xs font-semibold tracking-[0.16em] text-[#5B21B6] uppercase">{content.eyebrow}</p>
            <h1 className="mx-auto mt-5 max-w-[900px] text-[clamp(40px,6.4vw,76px)] leading-[0.98] font-extrabold text-balance">
              {content.title}
            </h1>
            <p className="mx-auto mt-5 max-w-[720px] text-lg leading-8 text-[#43434C]">{content.description}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={primaryHref(props.pageKey)}
                className="inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-lg bg-[#070707] px-5 text-sm font-bold text-white"
                style={{ color: "#fff" }}
              >
                {content.primary}
                <ArrowRight className="size-4" />
              </a>
              <Link
                href={secondaryHref(props.pageKey, props.locale)}
                className="inline-flex h-12 min-w-40 items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-[#0B0B0F] shadow-[inset_0_0_0_1px_#0B0B0F14]"
              >
                {content.secondary}
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-10 md:px-10">
          <div className="mx-auto grid max-w-[1120px] gap-4 md:grid-cols-3">
            {content.stats.map((stat) => (
              <div key={`${stat.value}-${stat.label}`} className="rounded-lg border border-[#0B0B0F14] bg-white p-5">
                <div className="text-3xl font-extrabold">{stat.value}</div>
                <div className="mt-2 text-sm font-semibold text-[#666672]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-16 md:px-10 md:pb-24">
          <div className="mx-auto grid max-w-[1120px] gap-4 lg:grid-cols-3">
            {content.sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-[#0B0B0F14] bg-white p-6 shadow-[0_24px_70px_-58px_rgba(11,11,15,.45)]">
                <div className="mb-5 inline-flex size-10 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#5B21B6]">
                  <CheckCircle2 className="size-5" />
                </div>
                <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[#83838E] uppercase">{section.kicker}</p>
                <h2 className="mt-3 text-2xl leading-tight font-extrabold">{section.title}</h2>
                <p className="mt-4 text-[15px] leading-7 text-[#43434C]">{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
