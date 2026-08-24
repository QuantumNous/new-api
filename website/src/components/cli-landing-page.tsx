import { ArrowRight, BadgeDollarSign, Check, FileVideo2, GitBranch, ImageIcon, KeyRound, Layers3, MonitorPlay, Play, Terminal, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import {
  CLI_IMAGE_PATH,
  CLI_LANDING_PATH,
  CLI_VIDEO_PATH,
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
const mediaAssets: Array<{
  href: string;
  icon: typeof ImageIcon;
  kind: "image" | "video";
  type: "image" | "video";
  media: string;
  poster?: string;
  showPlay: boolean;
}> = [
  {
    href: CLI_IMAGE_PATH,
    icon: ImageIcon,
    kind: "image",
    type: "image",
    media: "/assets/cli/campaign-hero.png",
    showPlay: false,
  },
  {
    href: CLI_VIDEO_PATH,
    icon: Play,
    kind: "video",
    type: "video",
    media: "/assets/cli/product-reveal.png",
    poster: "/assets/cli/product-reveal.png",
    showPlay: true,
  },
];

const mediaCategoryLabels: Record<Locale, Record<"image" | "video", string>> = {
  en: { image: "Image", video: "Video" },
  zh: { image: "图像", video: "视频" },
  es: { image: "Imagen", video: "Video" },
  fr: { image: "Image", video: "Video" },
  pt: { image: "Imagem", video: "Video" },
  ru: { image: "Image", video: "Video" },
  ja: { image: "画像", video: "動画" },
  vi: { image: "Hình ảnh", video: "Video" },
  de: { image: "Bild", video: "Video" },
  id: { image: "Image", video: "Video" },
};

export function CliLandingPage(props: CliLandingPageProps) {
  const copy = cliLandingCopy[props.locale];
  const keyUrl = consoleUrl("/keys", `lng=${props.locale}`);

  return (
    <SiteShell locale={props.locale} pathname={CLI_LANDING_PATH}>
      <main className="cli-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_30%,#ffffff_58%,#f4f1ff_100%)] text-[#0B0B0F]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-60"
        />
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
        <MediaExamples copy={copy.sections.media} locale={props.locale} />

        <section className="relative z-10 border-y border-violet-500/10 bg-white/45 px-6 py-18 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
              {copy.sections.workflow.eyebrow}
            </p>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <h2 className="max-w-xl text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                  {copy.sections.workflow.title}
                </h2>
                <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
                  {copy.sections.workflow.body}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {copy.sections.workflow.cards.map((card, index) => {
                  const Icon = workflowIcons[index % workflowIcons.length];
                  return (
                    <article key={card.title} className="rounded-lg border border-violet-500/16 bg-white/70 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm">
                      <Icon className="mb-4 size-5 text-violet-700" strokeWidth={1.8} />
                      <h3 className="font-semibold tracking-tight">{card.title}</h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-6">{card.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 px-6 py-18">
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

function MediaExamples(props: { copy: (typeof cliLandingCopy)[Locale]["sections"]["media"]; locale: Locale }) {
  const examples = [
    props.copy.items.find((item) => item.kind.toLowerCase().includes("image") || item.kind.includes("图片") || item.kind.includes("画像") || item.kind.includes("圖")),
    props.copy.items.find((item) => item.kind.toLowerCase().includes("video") || item.kind.includes("视频") || item.kind.includes("視頻") || item.kind.includes("動画") || item.kind.includes("Vídeo")),
  ].filter(Boolean) as typeof props.copy.items;

  return (
    <section className="relative z-10 border-y border-violet-500/10 bg-white/35 px-6 py-18 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{props.copy.eyebrow}</p>
            <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight md:text-4xl">{props.copy.title}</h2>
          </div>
          <p className="text-muted-foreground max-w-md text-sm leading-6">
            {props.copy.body}
          </p>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {mediaAssets.map((asset, index) => {
            const example = examples[index] ?? props.copy.items[index];
            const Icon = asset.icon;
            const label = mediaCategoryLabels[props.locale][asset.kind];
            return (
            <Link key={example.title} href={localizePath(asset.href, props.locale)} className="group overflow-hidden rounded-lg border border-violet-500/16 bg-white/70 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.68)] backdrop-blur-sm transition-transform hover:-translate-y-0.5">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#111412]">
                <Image
                  src={asset.type === "video" && asset.poster ? asset.poster : asset.media}
                  alt={example.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Icon className="size-3.5" />
                  {label}
                </div>
                {asset.showPlay ? (
                  <div className="absolute right-4 bottom-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/55 bg-white/90 text-violet-700 shadow-[0_16px_32px_-20px_rgba(11,11,15,0.55)]">
                    <Play className="ml-0.5 size-5 fill-current" />
                  </div>
                ) : null}
                <div className="absolute right-4 left-4 bottom-4 hidden md:block">
                  <div className="h-2 rounded bg-black/15" style={{ width: `${72 - index * 5}%` }} />
                  <div className="mt-2 h-2 rounded bg-white/55" style={{ width: `${46 + index * 6}%` }} />
                </div>
              </div>
              <div className="p-5">
                <h3 className="flex items-center justify-between gap-3 font-semibold tracking-tight">
                  <span>{label}</span>
                  <ArrowRight className="size-4 shrink-0 text-violet-700 transition-transform group-hover:translate-x-0.5" />
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{example.body}</p>
                <p className="mt-4 rounded-md bg-[#161020] p-3 text-[11px] leading-5 font-semibold tracking-[0.08em] text-violet-100 uppercase">{example.outcome}</p>
              </div>
            </Link>
            );
          })}
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
    <section className="relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-20 lg:pt-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 52% 42% at 50% 14%, rgba(124,58,237,0.26) 0%, rgba(217,70,239,0.12) 38%, transparent 78%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 shadow-[0_12px_34px_-22px_rgba(124,58,237,0.75)]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-violet-500" />
            </span>
            {props.eyebrow}
          </p>
          <h1 className="text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight">
            {props.title}
            <span className="block bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent">{props.accent}</span>
          </h1>
          <p className="text-muted-foreground/80 mt-5 max-w-xl text-base leading-relaxed md:text-[15px]">{props.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="flatkey-hero-cta group inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-colors hover:opacity-90" href={props.primaryHref} target="_blank" rel="noopener noreferrer">
              {props.primaryCta}
              <ArrowRight className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
            <a className="inline-flex h-11 items-center rounded-lg border border-violet-500/20 bg-white/65 px-5 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10" href={props.secondaryHref}>
              {props.secondaryCta}
            </a>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {props.stats.map((stat) => (
              <div key={stat.label} className="border-l border-violet-500/16 pl-3">
                <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">{stat.value}</div>
                <div className="text-muted-foreground mt-1 text-xs leading-5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-violet-500/16 bg-white/72 p-4 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.78)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/flatkey-mark.svg" alt="Flatkey" width={28} height={28} className="size-7" />
              <span className="text-sm font-semibold">flatkey-cli</span>
            </div>
            <a className="text-xs font-semibold text-violet-700 hover:underline" href={CLI_GITHUB_URL} target="_blank" rel="noopener noreferrer">
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
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#161020]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-xs text-white/55">{props.label}</span>
        <span className="font-mono text-xs text-violet-300">$</span>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 whitespace-pre-wrap text-violet-100">
        <code>{props.code}</code>
      </pre>
    </div>
  );
}

function InfoPanel(props: { title: string; body: string; bullets: string[]; icon: ReactNode; code?: string }) {
  return (
    <article className="rounded-lg border border-violet-500/16 bg-white/72 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-700">
        {props.icon}
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{props.title}</h2>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{props.body}</p>
      <ul className="mt-5 space-y-2">
        {props.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-sm leading-6">
            <Check className="mt-1 size-4 shrink-0 text-emerald-600" />
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
    <section className="relative z-10 border-y border-violet-500/10 bg-white/45 px-6 py-18 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight">{props.title}</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {props.items.map((item) => (
            <article key={item.title} className="rounded-lg border border-violet-500/16 bg-white/70 p-5 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.58)] backdrop-blur-sm">
              <h3 className="font-semibold tracking-tight">{item.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq(props: { title: string; items: Array<{ question: string; answer: string }> }) {
  return (
    <section className="relative z-10 px-6 py-18">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-semibold tracking-tight">{props.title}</h2>
        <div className="mt-8 divide-y divide-violet-500/10 rounded-lg border border-violet-500/16 bg-white/72 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.58)] backdrop-blur-sm">
          {props.items.map((item) => (
            <div key={item.question} className="p-5">
              <h3 className="font-semibold tracking-tight">{item.question}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{item.answer}</p>
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
    <section className="relative z-10 border-t border-violet-500/10 px-6 py-18">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-lg bg-[#161020] p-8 text-white shadow-[0_24px_70px_-44px_rgba(91,33,182,0.8)] md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight">{props.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{props.body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <a className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold !text-black hover:bg-white/90" href={props.primaryHref} target="_blank" rel="noopener noreferrer">
            {props.primaryCta}
          </a>
          <a className="inline-flex h-11 items-center rounded-lg border border-white/20 px-5 text-sm font-semibold hover:bg-white/10" href={props.secondaryHref}>
            {props.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}
