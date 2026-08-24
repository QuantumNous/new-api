import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  CircleDollarSign,
  DatabaseZap,
  KeyRound,
  Layers3,
  SearchCheck,
} from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { ToolsCommandBox } from "@/components/tools-command-box";
import {
  APIFY_ALTERNATIVE_PATH,
  APIFY_ALTERNATIVE_SETUP_COMMAND,
  apifyAlternativeCopy as copy,
  getApifyAlternativeMarketplaceUrl,
  getApifyAlternativeSignupUrl,
} from "@/lib/tools-conquest-landing";

const benefitIcons = [Layers3, CircleDollarSign, SearchCheck, DatabaseZap] as const;

export function ApifyAlternativePage() {
  const marketplaceUrl = getApifyAlternativeMarketplaceUrl();
  const signupUrl = getApifyAlternativeSignupUrl();

  return (
    <SiteShell locale="en" pathname={APIFY_ALTERNATIVE_PATH} hideLanguageSwitcher>
      <div className="overflow-hidden bg-[#f8f7f2] text-[#111114] dark:bg-[#07070a] dark:text-white">
        <section className="relative border-b border-black/8 px-5 pt-28 pb-20 sm:px-6 md:pt-36 md:pb-28 dark:border-white/8">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_46%_-12%,rgba(124,58,237,0.2),transparent_38%),linear-gradient(to_right,rgba(103,72,155,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(103,72,155,0.055)_1px,transparent_1px)] bg-[size:auto,72px_72px,72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)] dark:opacity-60" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.03fr_0.97fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/18 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm backdrop-blur dark:bg-white/5 dark:text-violet-200">
                <Bot className="size-3.5" />
                {copy.badge}
              </div>
              <h1 className="mt-7 text-[clamp(3rem,7vw,5.7rem)] leading-[0.95] font-bold tracking-[-0.06em]">
                {copy.h1Lead}{" "}
                <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-indigo-300">
                  {copy.h1Accent}
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#666269] md:text-lg dark:text-white/58">{copy.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={marketplaceUrl} className="flatkey-primary-cta group inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold shadow-[0_18px_40px_-22px_rgba(124,58,237,0.75)]">
                  {copy.primaryCta}<ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a href={signupUrl} className="inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white/70 px-6 text-sm font-semibold transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/9">
                  {copy.secondaryCta}
                </a>
              </div>
              <p className="mt-5 text-xs leading-5 text-[#777178] dark:text-white/44">{copy.trustLine}</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.6rem] border border-black/8 bg-white/76 p-5 shadow-[0_34px_90px_-64px_rgba(45,25,70,0.9)] backdrop-blur sm:p-7 dark:border-white/8 dark:bg-white/[0.035]">
                <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-[#706a74] uppercase dark:text-white/45">{copy.setupLabel}</p>
                <ToolsCommandBox command={APIFY_ALTERNATIVE_SETUP_COMMAND} copyLabel={copy.copyLabel} copiedLabel={copy.copiedLabel} />
              </div>
              <div className="overflow-hidden rounded-[1.6rem] border border-black/8 bg-[#101014] text-white shadow-[0_34px_90px_-64px_rgba(45,25,70,0.9)] dark:border-white/8">
                <div className="flex h-11 items-center gap-1.5 border-b border-white/8 px-4">
                  <i className="size-2.5 rounded-full bg-[#ff675f]" /><i className="size-2.5 rounded-full bg-[#ffbd2e]" /><i className="size-2.5 rounded-full bg-[#29c940]" />
                  <span className="ml-2 font-mono text-[10px] text-white/36">{copy.previewTitle}</span>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  {copy.previewSteps.map((step, index) => (
                    <div key={step.label} className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/18 font-mono text-[10px] text-violet-200">{index + 1}</span>
                      <div><strong className="block text-sm font-semibold">{step.label}</strong><span className="mt-1 block text-xs leading-5 text-white/48">{step.value}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/8 bg-white/55 px-5 py-20 sm:px-6 md:py-28 dark:border-white/8 dark:bg-white/[0.025]">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow={copy.whyEyebrow} title={copy.whyTitle} body={copy.whyBody} />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {copy.benefits.map((benefit, index) => {
                const Icon = benefitIcons[index];
                return (
                  <article key={benefit.title} className="rounded-2xl border border-black/8 bg-[#fbfaf6] p-6 dark:border-white/8 dark:bg-white/[0.035]">
                    <Icon className="size-6 text-violet-700 dark:text-violet-300" strokeWidth={1.7} />
                    <h2 className="mt-7 text-lg font-semibold tracking-tight">{benefit.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-[#747076] dark:text-white/48">{benefit.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 md:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow={copy.comparisonEyebrow} title={copy.comparisonTitle} body={copy.comparisonBody} />
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    {copy.comparisonHeaders.map((header, index) => (
                      <th key={header} className={`border-b border-black/10 px-5 py-4 font-semibold dark:border-white/10 ${index === 1 ? "bg-violet-500/7 text-violet-800 dark:text-violet-200" : ""}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {copy.comparisonRows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, index) => (
                        <td key={cell} className={`border-b border-black/8 px-5 py-5 align-top leading-6 dark:border-white/8 ${index === 0 ? "font-semibold" : "text-[#666269] dark:text-white/55"} ${index === 1 ? "bg-violet-500/7" : ""}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#777178] dark:text-white/44">
              <span>{copy.comparisonNote}</span>
              {copy.sourceLinks.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">{source.label}</a>)}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#111014] px-5 py-20 text-white sm:px-6 md:py-28">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(124,58,237,0.24),transparent_36%),radial-gradient(circle_at_82%_75%,rgba(217,70,239,0.14),transparent_35%)]" />
          <div className="relative mx-auto max-w-6xl">
            <SectionHeading eyebrow={copy.migrationEyebrow} title={copy.migrationTitle} />
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {copy.migrationSteps.map((step) => (
                <article key={step.number} className="border-t border-white/16 pt-5">
                  <span className="font-mono text-xs text-violet-300">{step.number}</span>
                  <h2 className="mt-7 text-xl font-semibold">{step.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/52">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/8 bg-white/55 px-5 py-20 sm:px-6 md:py-28 dark:border-white/8 dark:bg-white/[0.025]">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SectionHeading eyebrow={copy.useCasesEyebrow} title={copy.useCasesTitle} />
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.useCases.map((useCase) => (
                <div key={useCase} className="flex gap-3 rounded-xl border border-black/8 bg-[#fbfaf6] p-4 text-sm leading-6 dark:border-white/8 dark:bg-white/[0.035]">
                  <Check className="mt-1 size-4 shrink-0 text-violet-700 dark:text-violet-300" />{useCase}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 md:py-28">
          <div className="mx-auto max-w-5xl">
            <SectionHeading eyebrow={copy.faqEyebrow} title={copy.faqTitle} />
            <div className="mt-10 divide-y divide-black/8 border-y border-black/8 dark:divide-white/8 dark:border-white/8">
              {copy.faqs.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-semibold marker:content-none">
                    {item.question}<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-lg font-normal transition-transform group-open:rotate-45 dark:border-white/12">+</span>
                  </summary>
                  <p className="max-w-3xl pt-3 pr-10 text-sm leading-7 text-[#747076] dark:text-white/48">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/8 px-5 py-24 text-center sm:px-6 md:py-32 dark:border-white/8">
          <div className="mx-auto max-w-3xl">
            <KeyRound className="mx-auto size-8 text-violet-600 dark:text-violet-300" strokeWidth={1.6} />
            <h2 className="mt-6 text-3xl leading-tight font-bold tracking-tight md:text-5xl">{copy.finalTitle}</h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#747076] md:text-base dark:text-white/48">{copy.finalBody}</p>
            <a href={marketplaceUrl} className="flatkey-primary-cta group mt-8 inline-flex h-12 items-center rounded-xl px-6 text-sm font-semibold shadow-[0_18px_44px_-22px_rgba(124,58,237,0.78)]">
              {copy.finalCta}<ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <p className="mt-5 text-xs text-[#777178] dark:text-white/40">Flatkey is not affiliated with Apify.</p>
            <Link href="/tools" className="mt-4 inline-block text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">Explore all Flatkey Tools</Link>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function SectionHeading(props: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold tracking-[0.16em] text-violet-700 uppercase dark:text-violet-300">{props.eyebrow}</p>
      <h2 className="mt-4 text-3xl leading-tight font-bold tracking-tight md:text-5xl">{props.title}</h2>
      {props.body ? <p className="mt-5 text-sm leading-7 text-[#747076] md:text-base dark:text-white/48">{props.body}</p> : null}
    </div>
  );
}
