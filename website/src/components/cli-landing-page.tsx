import { ArrowRight, BadgeDollarSign, Check, FileVideo2, GitBranch, KeyRound, Layers3, MonitorPlay, Terminal, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import {
  CLI_LANDING_PATH,
  HIGGSFIELD_ALTERNATIVE_PATH,
  cliLandingCopy,
  higgsfieldAlternativeCopy,
} from "@/lib/cli-landing";
import { type Locale, localizePath } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

type CliLandingPageProps = {
  locale: Locale;
};

type HiggsfieldAlternativePageProps = {
  locale: Locale;
};

const CLI_NPM_URL = "https://www.npmjs.com/package/@flatkey-ai/cli";
const CLI_GITHUB_URL = "https://github.com/flatkey-ai/flatkey-cli";

const workflowIcons = [FileVideo2, WandSparkles, MonitorPlay, Terminal] as const;
const painIcons = [BadgeDollarSign, GitBranch, Layers3, Check] as const;
const mediaExamples = [
  {
    kind: "Video",
    title: "9:16 UGC ad clips",
    body: "Batch product demos, hooks, creator-style intros, and first-frame variations for paid social.",
    command: "flatkey video generate --ratio 9:16 --prompt-file briefs/ugc.txt -o outputs/ads/",
    tone: "from-rose-300 via-orange-200 to-amber-100",
  },
  {
    kind: "Image",
    title: "Campaign hero images",
    body: "Turn a launch brief into covers, landing-page visuals, product scenes, and thumbnail options.",
    command: "flatkey image generate --prompt \"premium skincare launch hero\" -o hero.png",
    tone: "from-emerald-300 via-cyan-200 to-slate-100",
  },
  {
    kind: "Video",
    title: "Product reveal sequences",
    body: "Use first-frame and last-frame inputs to make repeatable reveal clips for the same SKU.",
    command: "flatkey video generate --first-frame packshot.png --last-frame reveal.png -o reveal.mp4",
    tone: "from-violet-300 via-fuchsia-200 to-pink-100",
  },
  {
    kind: "Image",
    title: "Thumbnail test sets",
    body: "Generate twenty visual directions, save them locally, and let an agent rank or caption them.",
    command: "flatkey image batch --prompts thumbnails.csv -o outputs/thumbs/",
    tone: "from-lime-300 via-yellow-200 to-stone-100",
  },
  {
    kind: "Video",
    title: "Localized market variants",
    body: "Create Brazil, Japan, and US versions with different text overlays, mood, and aspect ratios.",
    command: "flatkey video batch --brief launch.md --markets us,br,jp --json",
    tone: "from-sky-300 via-blue-200 to-indigo-100",
  },
  {
    kind: "Image + Video",
    title: "Storyboard to motion",
    body: "Generate still frames first, pick the best shots, then turn them into short motion clips.",
    command: "flatkey storyboard run --brief storyboard.md -o outputs/story/",
    tone: "from-zinc-300 via-stone-200 to-neutral-100",
  },
] as const;

export function CliLandingPage(props: CliLandingPageProps) {
  const copy = cliLandingCopy[props.locale];
  const keyUrl = consoleUrl("/keys", `lng=${props.locale}`);

  return (
    <SiteShell locale={props.locale} pathname={CLI_LANDING_PATH}>
      <main className="min-h-screen bg-[#f8f7f2] text-[#151615] dark:bg-[#070807] dark:text-[#f6f4ee]">
        <Hero
          eyebrow={copy.hero.eyebrow}
          title={copy.hero.title}
          accent={copy.hero.accent}
          body={copy.hero.body}
          primaryCta={copy.hero.primaryCta}
          primaryHref={CLI_NPM_URL}
          secondaryCta={copy.hero.secondaryCta}
          secondaryHref={keyUrl}
          stats={copy.stats}
          code={copy.codeSamples[0]}
        />
        <MediaExamples />

        <section className="border-y border-black/10 bg-white/70 px-6 py-18 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mx-auto max-w-6xl">
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">
              {copy.sections.workflow.eyebrow}
            </p>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <h2 className="max-w-xl text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                  {copy.sections.workflow.title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#5f665f] dark:text-[#b7bdb4]">
                  {copy.sections.workflow.body}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {copy.sections.workflow.cards.map((card, index) => {
                  const Icon = workflowIcons[index % workflowIcons.length];
                  return (
                    <article key={card.title} className="rounded-lg border border-black/10 bg-[#fbfaf6] p-5 dark:border-white/10 dark:bg-white/[0.04]">
                      <Icon className="mb-4 size-5 text-emerald-700 dark:text-emerald-300" strokeWidth={1.8} />
                      <h3 className="font-semibold tracking-tight">{card.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">{card.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-18">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <InfoPanel title={copy.sections.spend.title} body={copy.sections.spend.body} bullets={copy.sections.spend.bullets} icon={<KeyRound className="size-5" />} />
            <InfoPanel title={copy.sections.agent.title} body={copy.sections.agent.body} bullets={copy.sections.agent.bullets} icon={<Terminal className="size-5" />} code={copy.codeSamples[1].code} />
          </div>
        </section>

        <UseCases title={copy.sections.useCases.title} items={copy.sections.useCases.items} />
        <Faq title={copy.sections.faq.title} items={copy.sections.faq.items} />
        <ClosingCta
          title={copy.sections.cta.title}
          body={copy.sections.cta.body}
          primaryCta={copy.sections.cta.primaryCta}
          primaryHref={CLI_NPM_URL}
          secondaryCta={copy.sections.cta.secondaryCta}
          secondaryHref={keyUrl}
        />
      </main>
    </SiteShell>
  );
}

export function HiggsfieldAlternativePage(props: HiggsfieldAlternativePageProps) {
  const copy = higgsfieldAlternativeCopy[props.locale];
  const keyUrl = consoleUrl("/keys", `lng=${props.locale}`);

  return (
    <SiteShell locale={props.locale} pathname={HIGGSFIELD_ALTERNATIVE_PATH}>
      <main className="min-h-screen bg-[#f8f7f2] text-[#151615] dark:bg-[#070807] dark:text-[#f6f4ee]">
        <section className="px-6 pt-28 pb-16 md:pt-34">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-amber-700/20 bg-amber-100/70 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-amber-800 uppercase dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">
                {copy.hero.eyebrow}
              </p>
              <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">{copy.hero.title}</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#5f665f] md:text-lg dark:text-[#b7bdb4]">{copy.hero.body}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="inline-flex h-11 items-center rounded-lg bg-[#151615] px-5 text-sm font-semibold !text-white hover:bg-black dark:bg-white dark:!text-black" href={CLI_NPM_URL} target="_blank" rel="noopener noreferrer">
                  {copy.hero.primaryCta}
                  <ArrowRight className="ml-2 size-4" />
                </a>
                <a className="inline-flex h-11 items-center rounded-lg border border-black/15 px-5 text-sm font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/8" href="#comparison">
                  {copy.hero.secondaryCta}
                </a>
              </div>
            </div>
            <div className="rounded-lg border border-black/10 bg-white p-4 shadow-[0_24px_70px_-50px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-white/[0.04]">
              <div className="rounded-md border border-black/10 bg-[#111412] p-4 text-[#e7f1e8] dark:border-white/10">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs text-white/55">flatkey production run</span>
                  <Image src="/flatkey-mark-dark.svg" alt="Flatkey" width={24} height={24} className="size-6" />
                </div>
                <pre className="overflow-x-auto text-[12px] leading-6 whitespace-pre-wrap text-emerald-100">
                  <code>{copy.migration.code}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/70 px-6 py-14 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{copy.position.title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#5f665f] dark:text-[#b7bdb4]">{copy.position.body}</p>
          </div>
        </section>

        <section id="comparison" className="px-6 py-18">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-tight">{copy.comparison.title}</h2>
            <div className="mt-8 overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.04]">
              <div className="grid grid-cols-[0.85fr_1fr_1fr] border-b border-black/10 bg-[#ebe8de] text-sm font-semibold dark:border-white/10 dark:bg-white/[0.08]">
                {copy.comparison.headers.map((header) => (
                  <div key={header} className="p-4">{header}</div>
                ))}
              </div>
              {copy.comparison.rows.map((row) => (
                <div key={row[0]} className="grid grid-cols-[0.85fr_1fr_1fr] border-b border-black/8 text-sm last:border-b-0 dark:border-white/8">
                  <div className="p-4 font-semibold">{row[0]}</div>
                  <div className="p-4 leading-6 text-[#4f554f] dark:text-[#c5c9c2]">{row[1]}</div>
                  <div className="p-4 leading-6 text-[#4f554f] dark:text-[#c5c9c2]">{row[2]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#ebe8de] px-6 py-18 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mx-auto max-w-6xl">
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-amber-800 uppercase dark:text-amber-200">{copy.pains.eyebrow}</p>
            <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-4xl">{copy.pains.title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#5f665f] dark:text-[#b7bdb4]">{copy.pains.body}</p>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {copy.pains.items.map((item, index) => {
                const Icon = painIcons[index % painIcons.length];
                return (
                  <article key={item.title} className="rounded-lg border border-black/10 bg-[#f8f7f2] p-5 dark:border-white/10 dark:bg-white/[0.05]">
                    <Icon className="mb-4 size-5 text-amber-800 dark:text-amber-200" strokeWidth={1.8} />
                    <h3 className="font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-6 py-18">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <h2 className="text-3xl leading-tight font-semibold tracking-tight">{copy.migration.title}</h2>
              <p className="mt-4 text-base leading-7 text-[#5f665f] dark:text-[#b7bdb4]">{copy.migration.body}</p>
            </div>
            <CodeBlock label="flatkey-cli" code={copy.migration.code} />
          </div>
        </section>

        <ClosingCta
          title={copy.cta.title}
          body={copy.cta.body}
          primaryCta={copy.cta.primaryCta}
          primaryHref={CLI_NPM_URL}
          secondaryCta={copy.cta.secondaryCta}
          secondaryHref={keyUrl}
        />
      </main>
    </SiteShell>
  );
}

function MediaExamples() {
  return (
    <section className="border-y border-black/10 bg-[#ebe8de] px-6 py-18 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">Real media jobs</p>
            <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Use the CLI to produce files, not just prompts</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">
            Install once, run <code className="rounded bg-black/8 px-1.5 py-0.5 dark:bg-white/10">flatkey login</code>, then batch images and videos from briefs, folders, CSVs, or agents.
          </p>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {mediaExamples.map((example, index) => (
            <article key={example.title} className="overflow-hidden rounded-lg border border-black/10 bg-[#f8f7f2] dark:border-white/10 dark:bg-white/[0.05]">
              <div className={`relative aspect-[4/3] bg-gradient-to-br ${example.tone}`}>
                <div className="absolute inset-3 rounded-md border border-white/45 bg-white/15 shadow-inner" />
                <div className="absolute top-4 left-4 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">{example.kind}</div>
                {example.kind.includes("Video") ? (
                  <div className="absolute right-4 bottom-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-white">
                    <span className="ml-0.5 h-0 w-0 border-y-[7px] border-y-transparent border-l-[11px] border-l-white" />
                  </div>
                ) : null}
                <div className="absolute right-4 left-4 bottom-4">
                  <div className="h-2 rounded bg-black/15" style={{ width: `${72 - index * 5}%` }} />
                  <div className="mt-2 h-2 rounded bg-white/55" style={{ width: `${46 + index * 6}%` }} />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold tracking-tight">{example.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">{example.body}</p>
                <code className="mt-4 block rounded-md bg-[#111412] p-3 text-[11px] leading-5 whitespace-pre-wrap text-emerald-100">{example.command}</code>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Hero(props: {
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  primaryCta: string;
  primaryHref: string;
  secondaryCta: string;
  secondaryHref: string;
  stats: Array<{ value: string; label: string }>;
  code: { label: string; code: string };
}) {
  return (
    <section className="px-6 pt-28 pb-16 md:pt-34 md:pb-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-emerald-700/20 bg-emerald-100/70 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-emerald-800 uppercase dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200">
            {props.eyebrow}
          </p>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
            {props.title}
            <span className="block text-emerald-700 dark:text-emerald-300">{props.accent}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#5f665f] md:text-lg dark:text-[#b7bdb4]">{props.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="inline-flex h-11 items-center rounded-lg bg-[#151615] px-5 text-sm font-semibold !text-white hover:bg-black dark:bg-white dark:!text-black" href={props.primaryHref} target="_blank" rel="noopener noreferrer">
              {props.primaryCta}
              <ArrowRight className="ml-2 size-4" />
            </a>
            <a className="inline-flex h-11 items-center rounded-lg border border-black/15 px-5 text-sm font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/8" href={props.secondaryHref}>
              {props.secondaryCta}
            </a>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {props.stats.map((stat) => (
              <div key={stat.label} className="border-l border-black/12 pl-3 dark:border-white/12">
                <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-xs leading-5 text-[#6d736c] dark:text-[#aeb4ab]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-black/10 bg-white p-4 shadow-[0_24px_70px_-50px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/flatkey-mark.svg" alt="Flatkey" width={28} height={28} className="size-7 dark:hidden" />
              <Image src="/flatkey-mark-dark.svg" alt="Flatkey" width={28} height={28} className="hidden size-7 dark:block" />
              <span className="text-sm font-semibold">flatkey-cli</span>
            </div>
            <a className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300" href={CLI_GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
          <CodeBlock label={props.code.label} code={props.code.code} />
        </div>
      </div>
    </section>
  );
}

function CodeBlock(props: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-[#111412] dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-xs text-white/55">{props.label}</span>
        <span className="font-mono text-xs text-emerald-300">$</span>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 whitespace-pre-wrap text-emerald-100">
        <code>{props.code}</code>
      </pre>
    </div>
  );
}

function InfoPanel(props: { title: string; body: string; bullets: string[]; icon: ReactNode; code?: string }) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-emerald-700/20 bg-emerald-100 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200">
        {props.icon}
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{props.title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">{props.body}</p>
      <ul className="mt-5 space-y-2">
        {props.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-sm leading-6">
            <Check className="mt-1 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {props.code ? <div className="mt-5"><CodeBlock label="automation" code={props.code} /></div> : null}
    </article>
  );
}

function UseCases(props: { title: string; items: Array<{ title: string; body: string }> }) {
  return (
    <section className="border-y border-black/10 bg-[#ebe8de] px-6 py-18 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight">{props.title}</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {props.items.map((item) => (
            <article key={item.title} className="rounded-lg border border-black/10 bg-[#f8f7f2] p-5 dark:border-white/10 dark:bg-white/[0.05]">
              <h3 className="font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq(props: { title: string; items: Array<{ question: string; answer: string }> }) {
  return (
    <section className="px-6 py-18">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-semibold tracking-tight">{props.title}</h2>
        <div className="mt-8 divide-y divide-black/10 rounded-lg border border-black/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.04]">
          {props.items.map((item) => (
            <div key={item.question} className="p-5">
              <h3 className="font-semibold tracking-tight">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-[#626861] dark:text-[#b7bdb4]">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta(props: {
  title: string;
  body: string;
  primaryCta: string;
  primaryHref: string;
  secondaryCta: string;
  secondaryHref: string;
}) {
  return (
    <section className="border-t border-black/10 px-6 py-18 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg bg-[#151615] p-8 text-white md:flex-row md:items-center md:justify-between dark:bg-white dark:text-black">
        <div>
          <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight">{props.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 dark:text-black/65">{props.body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <a className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold !text-black hover:bg-white/90 dark:bg-black dark:!text-white dark:hover:bg-black/85" href={props.primaryHref} target="_blank" rel="noopener noreferrer">
            {props.primaryCta}
          </a>
          <a className="inline-flex h-11 items-center rounded-lg border border-white/20 px-5 text-sm font-semibold hover:bg-white/10 dark:border-black/15 dark:hover:bg-black/5" href={props.secondaryHref}>
            {props.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}
