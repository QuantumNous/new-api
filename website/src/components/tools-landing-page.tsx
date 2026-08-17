import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  CircleDollarSign,
  Clapperboard,
  CloudSun,
  Globe2,
  LayoutDashboard,
  MessagesSquare,
  MousePointer2,
  SearchCheck,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { ToolsCommandBox } from "@/components/tools-command-box";
import type { Locale } from "@/lib/locales";
import {
  getToolsMarketplaceUrl,
  getToolsSignupUrl,
  TOOLS_LANDING_PATH,
  TOOLS_SETUP_COMMAND,
  toolsLandingCopy,
} from "@/lib/tools-landing";

type Props = { locale: Locale };

const categoryIcons = [Globe2, UsersRound, MessagesSquare, ShoppingBag, MousePointer2, Clapperboard, SearchCheck, CloudSun] as const;
const methodIcons = [Bot, Braces, LayoutDashboard] as const;

export function ToolsLandingPage(props: Props) {
  const copy = toolsLandingCopy[props.locale];
  const marketplaceUrl = getToolsMarketplaceUrl(props.locale);
  const signupUrl = getToolsSignupUrl(props.locale);

  return (
    <SiteShell locale={props.locale} pathname={TOOLS_LANDING_PATH}>
      <main className="tools-landing home-landing relative overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] text-[#111114] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />

        <section className="relative z-10 overflow-hidden px-[var(--fk-site-gutter)] pt-24 pb-16 md:pt-32 md:pb-20 lg:pt-36">
          <div
            aria-hidden
            className="home-hero-glow pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-55"
            style={{ background: "var(--home-hero-glow)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(124,58,237,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.14)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_64%_52%_at_50%_28%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-35 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] dark:opacity-40"
          />
          <div className="mx-auto grid max-w-[var(--fk-site-max-width)] grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col items-start text-left lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 shadow-[0_12px_34px_-22px_rgba(124,58,237,0.75)] dark:text-violet-200">
                <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-70" /><span className="relative inline-flex size-1.5 rounded-full bg-violet-500" /></span>
                {copy.badge}
              </div>
              <h1 className="mt-5 max-w-3xl text-[clamp(2.25rem,5vw,4rem)] leading-[1.08] font-bold tracking-tight">
                {copy.heroLead} <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300">{copy.heroAccent}</span> {copy.heroTail}
              </h1>
              <p className="text-muted-foreground/80 mt-5 max-w-xl text-base leading-relaxed md:text-[15px]">{copy.heroBody}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={marketplaceUrl} className="flatkey-hero-cta group inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-colors hover:opacity-90">
                  {copy.primaryCta}<ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a href={signupUrl} className="inline-flex h-11 items-center rounded-lg border border-violet-500/20 bg-white/65 px-5 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10">
                  {copy.secondaryCta}
                </a>
              </div>
            </div>

            <div className="grid w-full gap-4 lg:col-span-5">
              <div className="rounded-2xl border border-violet-500/16 bg-white/62 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm sm:p-6 dark:bg-white/[0.03]">
                <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-[#706a74] uppercase dark:text-white/45">{copy.commandLabel}</p>
                <ToolsCommandBox command={TOOLS_SETUP_COMMAND} copyLabel={copy.copyLabel} copiedLabel={copy.copiedLabel} />
                <p className="mt-4 text-xs leading-5 text-[#777178] dark:text-white/44">{copy.heroNote}</p>
              </div>
              <AgentRunDemo prompt={copy.demoPrompt} lines={copy.demoLines} bill={copy.demoBill} />
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-violet-500/10 px-[var(--fk-site-gutter)] py-20 md:py-24">
          <div className="mx-auto max-w-[var(--fk-site-max-width)]">
            <SectionHeading eyebrow={copy.catalogEyebrow} title={copy.catalogTitle} body={copy.catalogBody} />
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {copy.categories.map((item, index) => {
                const Icon = categoryIcons[index];
                return (
                  <article key={item.title} className="group rounded-2xl border border-violet-500/16 bg-white/62 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/28 hover:bg-white/78 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/8 text-violet-700 transition-transform group-hover:scale-[1.03] dark:text-violet-300"><Icon className="size-5" strokeWidth={1.7} /></div>
                    <h3 className="mt-5 text-base font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#747076] dark:text-white/48">{item.body}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-8 flex justify-center">
              <a href={marketplaceUrl} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200">{copy.primaryCta}<ArrowRight className="size-4" /></a>
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-violet-500/10 px-[var(--fk-site-gutter)] py-20 md:py-24">
          <div className="mx-auto max-w-[var(--fk-site-max-width)]">
            <SectionHeading eyebrow={copy.flowEyebrow} title={copy.flowTitle} body={copy.flowBody} centered />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {copy.steps.map((step, index) => (
                <article key={step.label} className="relative overflow-hidden rounded-2xl border border-violet-500/16 bg-white/62 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm dark:bg-white/[0.03]">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-violet-700 dark:text-violet-300">{step.label}</span>
                  <div className="mt-7 flex items-center gap-2 rounded-xl border border-violet-500/12 bg-white/55 p-3 font-mono text-xs dark:border-white/7 dark:bg-black/35">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-[11px] font-bold text-white">{index + 1}</span>
                    <span className="text-[#59545c] dark:text-white/58">{step.meta}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#747076] dark:text-white/48">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 overflow-hidden bg-[#111014] px-[var(--fk-site-gutter)] py-20 text-white md:py-24">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.24),transparent_36%),radial-gradient(circle_at_80%_70%,rgba(217,70,239,0.14),transparent_35%)]" />
          <div className="relative mx-auto max-w-[var(--fk-site-max-width)]">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase">{copy.balanceEyebrow}</p>
                <h2 className="mt-4 max-w-xl text-3xl leading-tight font-bold tracking-tight md:text-5xl">{copy.balanceTitle}</h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 md:text-base">{copy.balanceBody}</p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                {copy.stats.map((stat) => (
                  <div key={stat.label} className="bg-[#17161b] p-5 sm:p-7">
                    <strong className="block text-2xl font-bold tracking-tight text-violet-200 sm:text-3xl">{stat.value}</strong>
                    <span className="mt-2 block text-xs text-white/46">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-violet-500/10 px-[var(--fk-site-gutter)] py-20 md:py-24">
          <div className="mx-auto max-w-[var(--fk-site-max-width)]">
            <SectionHeading eyebrow={copy.connectEyebrow} title={copy.connectTitle} body={copy.connectBody} centered />
            <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
              {copy.methods.map((method, index) => {
                const Icon = methodIcons[index];
                return (
                  <article key={method.title} className="rounded-2xl border border-violet-500/16 bg-white/62 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm dark:bg-white/[0.03]">
                    <Icon className="size-6 text-violet-700 dark:text-violet-300" strokeWidth={1.7} />
                    <h3 className="mt-8 text-xl font-semibold">{method.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#747076] dark:text-white/48">{method.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative z-10 border-y border-violet-500/10 bg-white/45 px-[var(--fk-site-gutter)] py-20 md:py-24 dark:bg-white/[0.025]">
          <div className="mx-auto max-w-4xl">
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

        <section className="relative z-10 px-[var(--fk-site-gutter)] py-24 text-center md:py-32">
          <div className="mx-auto max-w-3xl">
            <Sparkles className="mx-auto size-8 text-violet-600 dark:text-violet-300" strokeWidth={1.6} />
            <h2 className="mt-6 text-3xl leading-tight font-bold tracking-tight md:text-5xl">{copy.finalTitle}</h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#747076] md:text-base dark:text-white/48">{copy.finalBody}</p>
            <a href={marketplaceUrl} className="flatkey-primary-cta group mt-8 inline-flex h-12 items-center rounded-xl px-6 text-sm font-semibold shadow-[0_18px_44px_-22px_rgba(124,58,237,0.78)]">
              {copy.finalCta}<ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

function AgentRunDemo(props: { prompt: string; lines: string[]; bill: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-[#101014] text-white shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] dark:border-white/8">
      <div className="flex h-11 items-center gap-1.5 border-b border-white/8 px-4"><i className="size-2.5 rounded-full bg-[#ff675f]" /><i className="size-2.5 rounded-full bg-[#ffbd2e]" /><i className="size-2.5 rounded-full bg-[#29c940]" /><span className="ml-2 font-mono text-[10px] text-white/36">Flatkey Tools · agent run</span></div>
      <div className="p-5 font-mono text-[11px] leading-6 sm:p-6">
        <p className="text-white/70"><span className="text-violet-300">❯</span> {props.prompt}</p>
        <div className="mt-5 space-y-1.5">
          {props.lines.map((line) => <p key={line} className="flex gap-2 text-white/48"><Check className="mt-1 size-3.5 shrink-0 text-emerald-400" />{line}</p>)}
        </div>
        <div className="mt-5 border-t border-white/8 pt-4 text-violet-300"><CircleDollarSign className="mr-2 inline size-4" />{props.bill}</div>
      </div>
    </div>
  );
}

function SectionHeading(props: { eyebrow: string; title: string; body?: string; centered?: boolean }) {
  return (
    <div className={props.centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-xs font-semibold tracking-[0.16em] text-violet-700 uppercase dark:text-violet-300">{props.eyebrow}</p>
      <h2 className="mt-4 text-2xl leading-tight font-bold tracking-tight md:text-3xl">{props.title}</h2>
      {props.body ? <p className="text-muted-foreground/80 mt-4 text-sm leading-relaxed md:text-base">{props.body}</p> : null}
    </div>
  );
}
