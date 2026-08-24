import Link from "next/link";
import { ArrowRight, BadgeCheck, ShieldCheck, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { localizePath } from "@/lib/locales";
import { getMarketConfig, getMarketLandingCtaUrl } from "@/lib/market-landing";

type Props = {
  slug: string;
};

export function MarketLandingPage({ slug }: Props) {
  const cfg = getMarketConfig(slug);
  if (!cfg) return null;
  const { locale, copy } = cfg;
  const ctaUrl = getMarketLandingCtaUrl();

  return (
    <SiteShell locale={locale} pathname={slug} hideLanguageSwitcher>
      <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] text-slate-950 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        {/* Hero */}
        <section className="relative border-b border-violet-500/10 pt-24 pb-20 dark:border-white/10 md:pt-32 md:pb-24">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_46%_-18%,rgba(124,58,237,0.24),transparent_38%),radial-gradient(circle_at_82%_76%,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,#f6f2ff_0%,#fbfaff_48%,#ffffff_100%)] dark:bg-[radial-gradient(circle_at_50%_-20%,rgba(72,103,255,0.33),transparent_36%),radial-gradient(circle_at_86%_82%,rgba(16,185,129,0.18),transparent_32%),linear-gradient(180deg,#111a33_0%,#070911_48%,#05070d_100%)]"
          />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-50/85 px-4 py-2 font-mono text-xs font-bold tracking-[0.16em] text-emerald-700 uppercase dark:border-emerald-300/35 dark:bg-emerald-300/10 dark:text-emerald-300">
              <Wallet className="size-3.5" />
              {copy.badge}
            </div>
            <p className="mt-8 font-mono text-xs font-semibold tracking-[0.24em] text-violet-700 uppercase dark:text-violet-300">
              {copy.hero.eyebrow}
            </p>
            <h1 className="mt-4 text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.02] font-black tracking-tight text-balance">
              {copy.hero.title}{" "}
              <span className="bg-gradient-to-r from-[#10b981] via-[#5d8cff] to-[#a855f7] bg-clip-text text-transparent">
                {copy.hero.highlight}
              </span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 font-medium text-slate-600 dark:text-slate-300 md:text-xl">
              {copy.hero.subtitle}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={ctaUrl}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#10b981] to-[#5f86ff] px-7 text-base font-extrabold text-white shadow-[0_22px_70px_rgba(16,185,129,0.32)] transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                {copy.hero.primaryCta}
                <ArrowRight className="size-4" />
              </a>
              <Link
                href={localizePath("/pricing", locale)}
                className="inline-flex min-h-14 w-full items-center justify-center rounded-lg border border-slate-300 bg-white/70 px-7 text-base font-extrabold text-slate-950 transition-colors hover:border-violet-400/70 dark:border-slate-600/70 dark:bg-slate-950/30 dark:text-white dark:hover:border-violet-300/60 sm:w-auto"
              >
                {copy.hero.secondaryCta}
              </Link>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-500 dark:text-slate-500">{copy.hero.trustLine}</p>
          </div>
        </section>

        {/* Pain → solution table */}
        <section className="border-b border-violet-500/10 bg-white/55 px-6 py-20 dark:border-white/10 dark:bg-[#05070d] md:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-[clamp(1.8rem,4vw,2.8rem)] font-black tracking-tight">{copy.painsTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600 dark:text-slate-400">
              {copy.painsSubtitle}
            </p>
            <div className="mt-12 overflow-hidden rounded-2xl border border-violet-500/12 dark:border-white/10">
              <div className="grid grid-cols-1 gap-px bg-violet-500/12 md:grid-cols-2 dark:bg-white/10">
                <div className="bg-white px-6 py-4 text-sm font-bold tracking-wide text-slate-500 uppercase dark:bg-[#0a0d16]">
                  {copy.colYouSaid}
                </div>
                <div className="hidden bg-white px-6 py-4 text-sm font-bold tracking-wide text-emerald-600 uppercase md:block dark:bg-[#0a0d16] dark:text-emerald-400">
                  {copy.colWeSolve}
                </div>
                {copy.pains.map((pain, i) => (
                  <div key={i} className="contents">
                    <div className="bg-white px-6 py-6 text-lg font-semibold text-slate-800 italic dark:bg-[#080b13] dark:text-slate-200">
                      {pain.quote}
                    </div>
                    <div className="flex items-start gap-3 bg-emerald-50/40 px-6 py-6 text-base font-medium text-slate-700 dark:bg-emerald-500/5 dark:text-slate-300">
                      <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                      {pain.solution}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust anchor */}
        <section className="border-b border-violet-500/10 px-6 py-20 dark:border-white/10 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <ShieldCheck className="mx-auto size-12 text-emerald-500" />
            <h2 className="mt-6 text-[clamp(1.7rem,4vw,2.6rem)] font-black tracking-tight">{copy.trust.title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">{copy.trust.subtitle}</p>
            <ul className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-1">
              {copy.trust.points.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-violet-500/12 bg-white/70 px-5 py-4 text-base font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Premium hook + models */}
        <section className="border-b border-violet-500/10 bg-white/55 px-6 py-20 dark:border-white/10 dark:bg-[#05070d] md:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-50/80 to-white px-8 py-10 text-center dark:border-white/10 dark:from-violet-500/10 dark:to-transparent">
              <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-black tracking-tight">{copy.premium.title}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">{copy.premium.body}</p>
            </div>
            <div className="mt-12">
              <h3 className="text-center text-2xl font-black tracking-tight">{copy.models.title}</h3>
              <p className="mt-2 text-center text-base text-slate-600 dark:text-slate-400">{copy.models.subtitle}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {copy.models.items.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-violet-500/12 bg-white/70 px-5 py-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="text-base font-bold text-slate-900 dark:text-white">{m.name}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{m.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-violet-500/10 px-6 py-20 dark:border-white/10 md:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-[clamp(1.7rem,4vw,2.6rem)] font-black tracking-tight">{copy.faqTitle}</h2>
            <div className="mt-10 space-y-4">
              {copy.faqs.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-violet-500/12 bg-white/70 px-6 py-5 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{faq.question}</div>
                  <div className="mt-2 text-base text-slate-600 dark:text-slate-300">{faq.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[clamp(1.9rem,5vw,3.2rem)] font-black tracking-tight">{copy.finalCta.title}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{copy.finalCta.subtitle}</p>
            <a
              href={ctaUrl}
              className="mt-9 inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#10b981] to-[#5f86ff] px-8 text-base font-extrabold text-white shadow-[0_22px_70px_rgba(16,185,129,0.32)] transition-transform hover:-translate-y-0.5"
            >
              {copy.finalCta.button}
              <ArrowRight className="size-4" />
            </a>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
