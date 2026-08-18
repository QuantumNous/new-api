import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { localizePath } from "@/lib/locales";
import { ROUTER_ORIGIN } from "@/lib/origins";
import { cn } from "@/lib/utils";
import {
  SKAG_TRUST_LINE,
  getSkagLandingLocales,
  getSkagLandingCtaUrl,
  skagLandingPath,
  type SkagLandingConfig,
} from "@/lib/skag-landing";

type Props = {
  config: SkagLandingConfig;
};

// Google Ads SKAG landing page: the H1 echoes the ad keyword exactly and the
// first screen carries the value prop, price table, runnable snippet, CTA,
// and trust line. Styling mirrors the glm-landing/model-landing pages so the
// route looks native to the rest of the site.
export function SkagLandingPage({ config }: Props) {
  const ctaUrl = getSkagLandingCtaUrl();
  const apiBaseUrl = `${ROUTER_ORIGIN}/v1`;
  const locale = config.locale ?? "en";
  const pathname = config.pathname ?? skagLandingPath(config.slug);
  const trustLine = config.trustLine ?? SKAG_TRUST_LINE;
  const compactHero = config.compactHero ?? false;
  const hideCodeWindow = config.hideCodeWindow ?? false;
  const useWhitePrimaryCta = config.slug === "deepseek-api";

  return (
    <SiteShell
      locale={locale}
      pathname={pathname}
      expandNavigationAtTablet
      languageSwitcherLocales={getSkagLandingLocales(config.slug)}
    >
      <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] text-slate-950 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <section
          className={cn(
            "relative border-b border-violet-500/10 dark:border-white/10",
            compactHero ? "pt-10 pb-10 md:pt-12 md:pb-14" : "pt-20 pb-16 md:pt-28 md:pb-24"
          )}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_46%_-18%,rgba(124,58,237,0.24),transparent_38%),radial-gradient(circle_at_82%_76%,rgba(79,70,229,0.14),transparent_34%),linear-gradient(180deg,#f6f2ff_0%,#fbfaff_48%,#ffffff_100%)] dark:bg-[radial-gradient(circle_at_50%_-20%,rgba(72,103,255,0.33),transparent_36%),radial-gradient(circle_at_86%_82%,rgba(130,80,255,0.22),transparent_32%),linear-gradient(180deg,#111a33_0%,#070911_48%,#05070d_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.34] [background-image:linear-gradient(rgba(124,58,237,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.1)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_58%_at_50%_18%,black_0%,transparent_78%)] dark:opacity-[0.18] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)]"
          />
          <div
            className={cn(
              "relative mx-auto items-center px-6",
              hideCodeWindow ? "max-w-6xl" : "grid max-w-7xl",
              !hideCodeWindow && (compactHero ? "gap-8 xl:grid-cols-[1fr_1fr]" : "gap-12 lg:grid-cols-[1fr_1fr]")
            )}
          >
            <div className={cn(hideCodeWindow ? "mx-auto max-w-6xl text-center lg:text-left" : "mx-auto max-w-3xl text-center lg:mx-0 lg:text-left")}>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-50/85 px-4 py-2 font-mono text-xs font-bold tracking-[0.18em] text-emerald-700 uppercase shadow-[0_18px_48px_rgba(16,185,129,0.16)] dark:border-emerald-300/35 dark:bg-emerald-300/10 dark:text-emerald-300 dark:shadow-[0_0_40px_rgba(52,211,153,0.16)]">
                <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.75)] dark:bg-emerald-300 dark:shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
                {config.badge}
              </div>

              <h1
                className={cn(
                  "leading-[1.02] font-black tracking-tight text-balance",
                  compactHero ? "mt-5 text-[clamp(2.35rem,5.4vw,4.25rem)]" : "mt-7 text-[clamp(2.6rem,6.4vw,4.9rem)]"
                )}
              >
                {config.h1Lead}{" "}
                <span className="bg-gradient-to-r from-[#5d8cff] via-[#7f6bff] to-[#a855f7] bg-clip-text text-transparent">
                  {config.h1Accent}
                </span>
              </h1>
              <p
                className={cn(
                  "mx-auto max-w-2xl text-lg leading-8 font-medium text-slate-600 lg:mx-0 dark:text-slate-300",
                  compactHero ? "mt-4" : "mt-6"
                )}
              >
                {config.description}
              </p>

              <div className={cn("flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start", compactHero ? "mt-6" : "mt-8")}>
                <a
                  href={ctaUrl}
                  className={cn(
                    "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-7 text-base font-extrabold shadow-[0_22px_70px_rgba(95,134,255,0.35)] transition-transform hover:-translate-y-0.5 sm:w-auto",
                    useWhitePrimaryCta
                      ? "border border-slate-200 bg-white text-slate-950 shadow-[0_18px_46px_rgba(15,23,42,0.08)] hover:border-violet-400/70"
                      : "bg-gradient-to-r from-[#5f86ff] to-[#8357ff] text-white"
                  )}
                >
                  {config.ctaLabel}
                  <ArrowRight className="size-4" />
                </a>
                {!config.hideSecondaryCta && (
                  <Link
                    href={localizePath("/pricing", locale)}
                    className="inline-flex min-h-14 w-full items-center justify-center rounded-lg border border-slate-300 bg-white/70 px-7 text-base font-extrabold text-slate-950 shadow-[0_18px_46px_rgba(15,23,42,0.08)] transition-colors hover:border-violet-400/70 dark:border-slate-600/70 dark:bg-slate-950/30 dark:text-white dark:shadow-none dark:hover:border-violet-300/60 sm:w-auto"
                  >
                    {config.secondaryCtaLabel ?? "See live pricing"}
                  </Link>
                )}
              </div>
              <p className={cn("text-sm font-medium text-slate-500 dark:text-slate-500", compactHero ? "mt-4" : "mt-5")}>{trustLine}</p>

              <div className={cn("rounded-lg border border-violet-200/70 bg-white/80 p-5 text-left shadow-[0_18px_48px_rgba(79,70,229,0.08)] dark:border-slate-800 dark:bg-[#0d121c] dark:shadow-none", compactHero ? "mt-6" : "mt-8")}>
                <p className="font-mono text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">{config.pricingTitle}</p>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-violet-500/10 text-xs text-slate-400 dark:text-slate-500">
                      <th className="pb-2 text-left font-semibold">Modelo</th>
                      <th className="pb-2 text-right font-semibold">{config.pricingColumns?.platform ?? "Flatkey"}</th>
                      <th className="pb-2 text-right font-semibold">{config.pricingColumns?.reference ?? "Reference"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.priceRows.map((row) => (
                      <tr key={row.label} className="border-b border-violet-500/10 last:border-0">
                        <td className="py-2.5 pr-2 text-slate-600 dark:text-slate-400">{row.label}</td>
                        <td className="py-2.5 pr-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-300">{row.flatkey}</td>
                        <td className="py-2.5 text-right font-mono text-slate-400 line-through dark:text-slate-500">{row.official}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-600">{config.priceFootnote}</p>
              </div>
            </div>

            {!hideCodeWindow && <CodeWindow config={config} apiBaseUrl={apiBaseUrl} />}
          </div>
        </section>

        <section className="border-b border-violet-500/10 bg-[#fbfaff] px-6 py-16 dark:border-white/10 dark:bg-[#05070d] md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {config.features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-lg border border-violet-200/70 bg-white/80 p-6 shadow-[0_18px_48px_rgba(79,70,229,0.08)] dark:border-slate-800 dark:bg-[#0d121c] dark:shadow-none"
                >
                  <h2 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{feature.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f4f1ff_100%)] px-6 py-16 dark:!bg-none dark:bg-[#05070d] md:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-violet-300/40 bg-[linear-gradient(135deg,rgba(99,102,241,0.14),rgba(16,185,129,0.08),rgba(255,255,255,0.88))] p-8 shadow-[0_24px_80px_rgba(79,70,229,0.14)] dark:border-violet-400/25 dark:!bg-[linear-gradient(135deg,rgba(96,132,255,0.22),rgba(16,185,129,0.10),rgba(5,7,13,0.6))] dark:shadow-none">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
                {config.h1Lead} {config.h1Accent}
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">{config.description}</p>
              <a
                href={ctaUrl}
                className={cn(
                  "mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-black shadow-[0_20px_60px_rgba(95,134,255,0.25)] transition-transform hover:-translate-y-0.5",
                  useWhitePrimaryCta
                    ? "border border-slate-200 bg-white text-slate-950 shadow-[0_18px_46px_rgba(15,23,42,0.08)] hover:border-violet-400/70"
                    : "bg-gradient-to-r from-[#5f86ff] to-[#8357ff] text-white"
                )}
              >
                {config.ctaLabel}
                <ArrowRight className="size-4" />
              </a>
              <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-500">{trustLine}</p>
            </div>
            <div className="space-y-4">
              {config.faq.map((faq) => (
                <article
                  key={faq.question}
                  className="rounded-lg border border-violet-200/70 bg-white/80 p-6 shadow-[0_18px_48px_rgba(79,70,229,0.08)] dark:border-slate-800 dark:bg-[#0d121c] dark:shadow-none"
                >
                  <h3 className="text-base font-black text-slate-950 dark:text-white">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function CodeWindow({ config, apiBaseUrl }: { config: SkagLandingConfig; apiBaseUrl: string }) {
  const snippets = [
    {
      label: "Python",
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${apiBaseUrl}",
    api_key="YOUR_FLATKEY_KEY",
)

response = client.chat.completions.create(
    model="${config.exampleModel}",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)`,
    },
    {
      label: "curl",
      code: `curl ${apiBaseUrl}/chat/completions \\
  -H "Authorization: Bearer $FLATKEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${config.exampleModel}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#090d16] shadow-[0_34px_110px_rgba(79,70,229,0.20),0_14px_44px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:shadow-[0_40px_120px_rgba(0,0,0,0.34)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
        </div>
        <span className="font-mono text-xs text-slate-500">{config.codeTitle}</span>
      </div>
      <div className="grid gap-4 p-4">
        {snippets.map((snippet) => (
          <div key={snippet.label} className="min-w-0 rounded-lg border border-white/10 bg-[#060912]">
            <div className="border-b border-white/10 px-4 py-3 text-xs font-bold tracking-wide text-violet-300">{snippet.label}</div>
            <pre className="overflow-x-auto p-4 font-mono text-sm leading-7 text-slate-300">
              <code>{snippet.code}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
