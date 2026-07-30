import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, Compass, KeyRound, Scale, Workflow } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import {
  getToolsAdMarketplaceUrl,
  getToolsAdSignupUrl,
  toolsAdLandingPath,
  type ToolsAdLandingConfig,
} from "@/lib/tools-ad-landing";

export function ToolsAdLandingPage({ config }: { config: ToolsAdLandingConfig }) {
  const marketplaceUrl = getToolsAdMarketplaceUrl(config.slug);
  const signupUrl = getToolsAdSignupUrl(config.slug);

  return (
    <SiteShell locale="en" pathname={toolsAdLandingPath(config.slug)} hideLanguageSwitcher>
      <div className="min-h-screen overflow-hidden bg-[#f4f4ee] text-[#11130f] dark:bg-[#0a0c09] dark:text-[#f2f5ed]">
        <section className="relative border-b border-black/10 px-5 pt-20 pb-16 sm:px-6 md:pt-28 md:pb-24 dark:border-white/10">
          <div aria-hidden className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(17,19,15,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(17,19,15,.07)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)] dark:opacity-20 dark:[background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
            <div>
              <div className="inline-flex items-center gap-2 border border-black/12 bg-[#fbfbf6] px-3 py-2 font-mono text-[11px] font-bold tracking-[0.11em] uppercase dark:border-white/12 dark:bg-white/5">
                <span className="size-2 bg-[#9fe870]" />{config.badge}
              </div>
              <h1 className="mt-7 max-w-4xl text-[clamp(3rem,7vw,6.4rem)] leading-[0.91] font-black tracking-[-0.065em]">
                {config.h1}<br /><span className="text-[#1e67ff] dark:text-[#8fb4ff]">{config.h1Accent}</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-black/62 md:text-lg dark:text-white/58">{config.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={marketplaceUrl} className="group inline-flex h-13 items-center justify-center bg-[#11130f] px-6 text-sm font-bold !text-white transition-transform hover:-translate-y-0.5 dark:bg-[#f2f5ed] dark:!text-[#11130f]">
                  {config.primaryCta}<ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a href={signupUrl} className="inline-flex h-13 items-center justify-center border border-black/18 bg-transparent px-6 text-sm font-bold hover:bg-white/55 dark:border-white/18 dark:hover:bg-white/6">{config.secondaryCta}</a>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {config.chips.map((chip) => <span key={chip} className="border border-black/10 bg-white/55 px-3 py-1.5 text-xs text-black/58 dark:border-white/10 dark:bg-white/4 dark:text-white/48">{chip}</span>)}
              </div>
            </div>

            <div className="border border-black/14 bg-[#11130f] p-2 shadow-[18px_18px_0_#9fe870] dark:border-white/14 dark:shadow-[18px_18px_0_#2f6d30]">
              <div className="border border-white/10 bg-[#0b0d0a] text-white">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">
                  <span>flatkey / bounded run</span><span className="text-[#9fe870]">ready</span>
                </div>
                <div className="p-5 sm:p-7">
                  <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#9fe870] uppercase">{config.promptLabel}</p>
                  <p className="mt-3 border-l-2 border-[#1e67ff] pl-4 font-mono text-sm leading-7 text-white/82">{config.prompt}</p>
                  <div className="mt-7 border border-white/10 bg-white/[0.035]">
                    <div className="border-b border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.14em] text-white/42 uppercase">{config.receiptTitle}</div>
                    {config.receiptRows.map((row) => (
                      <div key={row.label} className="grid gap-1 border-b border-white/8 px-4 py-3 last:border-0 sm:grid-cols-[90px_1fr]">
                        <span className="font-mono text-[11px] text-[#9fe870]">✓ {row.label}</span><span className="text-xs leading-5 text-white/60">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between font-mono text-[10px] text-white/38">
                    <span>exact price shown before execution</span><span>one balance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#11130f] px-5 py-20 text-white sm:px-6 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex max-w-3xl items-start gap-4">
              <Compass className="mt-1 size-6 shrink-0 text-[#9fe870]" />
              <div><p className="font-mono text-xs tracking-[0.15em] text-[#9fe870] uppercase">Why Flatkey</p><h2 className="mt-4 text-3xl leading-tight font-black tracking-[-0.035em] md:text-5xl">One commercial surface for the whole job.</h2></div>
            </div>
            <div className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {config.benefits.map((benefit, index) => (
                <article key={benefit.title} className="bg-[#11130f] p-6 md:p-7">
                  <span className="font-mono text-xs text-white/28">0{index + 1}</span>
                  <h2 className="mt-10 text-xl font-bold tracking-tight">{benefit.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-white/48">{benefit.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <Workflow className="size-7 text-[#1e67ff] dark:text-[#8fb4ff]" />
                <h2 className="mt-5 text-3xl leading-tight font-black tracking-[-0.04em] md:text-5xl">{config.workflowTitle}</h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-black/56 md:text-base dark:text-white/48">{config.workflowBody}</p>
              </div>
              <div className="border-t border-black/14 dark:border-white/14">
                {config.workflowSteps.map((step) => (
                  <article key={step.number} className="grid gap-4 border-b border-black/14 py-7 sm:grid-cols-[70px_190px_1fr] dark:border-white/14">
                    <span className="font-mono text-xs text-[#1e67ff] dark:text-[#8fb4ff]">{step.number}</span>
                    <h3 className="font-bold">{step.title}</h3>
                    <p className="text-sm leading-6 text-black/54 dark:text-white/46">{step.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <Scale className="size-7 text-[#1e67ff] dark:text-[#8fb4ff]" />
              <p className="mt-5 font-mono text-xs tracking-[0.15em] text-[#1e67ff] uppercase dark:text-[#8fb4ff]">{config.comparison.eyebrow}</p>
              <h2 className="mt-4 text-3xl leading-tight font-black tracking-[-0.04em] md:text-5xl">{config.comparison.title}</h2>
              <p className="mt-5 text-sm leading-7 text-black/56 md:text-base dark:text-white/48">{config.comparison.body}</p>
            </div>
            <div className="mt-12 overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    {config.comparison.headers.map((header, index) => (
                      <th
                        key={header}
                        className={`border-b border-black/12 px-5 py-4 font-bold dark:border-white/12 ${index === 1 ? "bg-[#1e67ff]/8 text-[#1e67ff] dark:bg-[#8fb4ff]/10 dark:text-[#8fb4ff]" : "text-black/62 dark:text-white/58"}`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.comparison.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, index) => (
                        <td
                          key={cell}
                          className={`border-b border-black/8 px-5 py-5 align-top leading-6 dark:border-white/8 ${index === 0 ? "font-semibold" : "text-black/58 dark:text-white/52"} ${index === 1 ? "bg-[#1e67ff]/6 font-medium text-black/72 dark:bg-[#8fb4ff]/8 dark:text-white/72" : ""}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-6 text-black/45 dark:text-white/40">
              <span className="max-w-2xl">{config.comparison.note}</span>
              {config.comparison.sources.map((source) => (
                <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="font-semibold text-[#1e67ff] hover:underline dark:text-[#8fb4ff]">{source.label}</a>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#e8f0ff] px-5 py-20 sm:px-6 md:py-24 dark:border-white/10 dark:bg-[#0e182a]">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div><CircleDollarSign className="size-7 text-[#1e67ff] dark:text-[#8fb4ff]" /><h2 className="mt-5 text-3xl leading-tight font-black tracking-[-0.04em] md:text-5xl">{config.useCasesTitle}</h2></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.useCases.map((item) => <div key={item} className="flex gap-3 border border-black/10 bg-white/65 p-4 text-sm font-semibold dark:border-white/10 dark:bg-white/5"><Check className="mt-0.5 size-4 shrink-0 text-[#1e67ff] dark:text-[#8fb4ff]" />{item}</div>)}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-6 md:py-28">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-xs tracking-[0.15em] text-black/42 uppercase dark:text-white/38">Questions before the first run</p>
            <div className="mt-7 divide-y divide-black/12 border-y border-black/12 dark:divide-white/12 dark:border-white/12">
              {config.faqs.map((faq) => (
                <details key={faq.question} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-bold marker:content-none">{faq.question}<span className="font-mono text-2xl font-normal transition-transform group-open:rotate-45">+</span></summary>
                  <p className="max-w-3xl pt-4 pr-12 text-sm leading-7 text-black/54 dark:text-white/46">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 px-5 py-24 text-center sm:px-6 md:py-32 dark:border-white/10">
          <div className="mx-auto max-w-3xl">
            <KeyRound className="mx-auto size-8 text-[#1e67ff] dark:text-[#8fb4ff]" />
            <h2 className="mt-6 text-3xl leading-tight font-black tracking-[-0.04em] md:text-5xl">{config.finalTitle}</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-black/54 md:text-base dark:text-white/46">{config.finalBody}</p>
            <a href={marketplaceUrl} className="group mt-8 inline-flex h-13 items-center bg-[#11130f] px-7 text-sm font-bold !text-white dark:bg-[#f2f5ed] dark:!text-[#11130f]">{config.primaryCta}<ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" /></a>
            <Link href="/tools" className="mt-5 block text-xs font-semibold text-[#1e67ff] hover:underline dark:text-[#8fb4ff]">Explore all Flatkey Tools</Link>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
