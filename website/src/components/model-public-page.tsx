"use client";

import {
  Activity,
  ArrowRight,
  BadgePercent,
  ChevronRight,
  Code2,
  Gauge,
  HeartPulse,
  Timer,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { DailyHealthBars } from "@/components/home-health-bars";
import { ModelLogo } from "@/components/pricing-model-browser";
import {
  fetchHealthSummary,
  fetchModelTrend,
  formatCallCount,
  formatLatencyMs,
  formatSuccessRate,
  formatThroughput,
  trendAvgTtftMs,
  type HomePerfSummary,
  type HomeTrendPoint,
} from "@/lib/home-live";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import {
  MODEL_PUBLIC_COPY,
  buildModelExampleCurl,
  buildModelExampleNode,
  buildModelExamplePython,
  classifyModelHealthStatus,
  modelPublicPath,
  normalizeModelKey,
  type ModelPeer,
  type ModelPublicKind,
  type ModelPublicPriceRow,
} from "@/lib/model-public";
import { buildModelFaq, buildModelHowTo, buildModelIntro, modelSeoUi } from "@/lib/model-seo-content";
import { buildModelSchema, stringifyJsonLd } from "@/lib/schema";

export type ModelPublicPageProps = {
  locale: Locale;
  modelName: string;
  vendorName: string;
  vendorDescription: string;
  description: string;
  tags: string[];
  iconKey?: string;
  endpointTypes: string[];
  kind: ModelPublicKind;
  isTokenBilled: boolean;
  // Pre-formatted on the server from the pricing payload.
  priceRows: ModelPublicPriceRow[];
  savingsPct: number;
  inputList: string;
  inputDiscounted: string;
  outputDiscounted: string;
  inputDiscountedNum: number;
  comparison: ModelPeer[];
  related: ModelPeer[];
  apiBaseUrl: string;
  consoleTopUpUrl: string;
};

type CodeLang = "curl" | "python" | "node";
const CODE_LANGS: CodeLang[] = ["curl", "python", "node"];

export function ModelPublicPage(props: ModelPublicPageProps) {
  const copy = MODEL_PUBLIC_COPY[props.locale] ?? MODEL_PUBLIC_COPY.en;
  const ui = modelSeoUi(props.locale);
  const signUpUrl = localizePath("/sign-up", props.locale);
  const modelsUrl = localizePath("/models", props.locale);
  const peerUrl = (name: string) => localizePath(modelPublicPath(name), props.locale);

  // Health data is tagged with the model it belongs to, so navigating between
  // model pages never shows the previous model's numbers while the new request
  // is in flight (we only read the state when its model matches props).
  const [health, setHealth] = useState<{
    model: string;
    trend: HomeTrendPoint[];
    summary?: HomePerfSummary;
  }>({ model: "", trend: [] });
  const [lang, setLang] = useState<CodeLang>("curl");

  useEffect(() => {
    let cancelled = false;
    const model = props.modelName;
    const wanted = normalizeModelKey(model);
    // Whole-platform health (no group) — real total volume across all tiers.
    // Pass the model so the proxy returns only this model's summary row.
    Promise.all([fetchModelTrend(model), fetchHealthSummary(undefined, model)]).then(([points, byName]) => {
      if (cancelled) return;
      const summary =
        byName[model] ?? Object.values(byName).find((row) => normalizeModelKey(row.model_name) === wanted);
      setHealth({ model, trend: points, summary });
    });
    return () => {
      cancelled = true;
    };
  }, [props.modelName]);

  const fresh = health.model === props.modelName;
  const trend = fresh ? health.trend : [];
  const trendLoaded = fresh;
  const summary = fresh ? health.summary : undefined;

  const rates = trend.map((point) => point.success_rate).filter((value) => Number.isFinite(value));
  const trendSuccess = rates.length > 0 ? rates.reduce((sum, value) => sum + value, 0) / rates.length : undefined;
  const successRate = summary?.success_rate ?? trendSuccess;
  const ttft = summary?.avg_ttft_ms ?? trendAvgTtftMs(trend);
  const healthStatus = classifyModelHealthStatus(successRate);
  const online = healthStatus === "operational";
  const degraded = healthStatus === "degraded";

  // Programmatic SEO copy (English for now) + structured data, derived purely
  // from the live pricing so every model page is unique and crawlable.
  const seoInput = {
    modelName: props.modelName,
    vendorName: props.vendorName,
    kind: props.kind,
    isTokenBilled: props.isTokenBilled,
    savingsPct: props.savingsPct,
    inputList: props.inputList,
    inputDiscounted: props.inputDiscounted,
    outputDiscounted: props.outputDiscounted,
    routerBaseUrl: props.apiBaseUrl,
    comparison: props.comparison.map((peer) => ({ modelName: peer.modelName, inputPrice: peer.inputPrice })),
  };
  const intro = buildModelIntro(seoInput, props.locale);
  const howTo = buildModelHowTo(seoInput, props.locale);
  const faq = buildModelFaq(seoInput, props.locale);
  const schema = buildModelSchema({
    locale: props.locale,
    modelName: props.modelName,
    vendorName: props.vendorName,
    description: intro,
    inputPriceUsd: props.inputDiscountedNum,
    pagePath: peerUrl(props.modelName),
    faq,
  });

  const modality = props.kind === "image" ? "Image generation" : "Text / chat";
  const example =
    lang === "python"
      ? buildModelExamplePython({ apiBaseUrl: props.apiBaseUrl, modelName: props.modelName, kind: props.kind })
      : lang === "node"
        ? buildModelExampleNode({ apiBaseUrl: props.apiBaseUrl, modelName: props.modelName, kind: props.kind })
        : buildModelExampleCurl({ apiBaseUrl: props.apiBaseUrl, modelName: props.modelName, kind: props.kind });

  const about = props.description || props.vendorDescription;

  return (
    <main className="model-square-page relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] px-4 pt-28 pb-16 text-[#0B0B0F] sm:px-6 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(schema) }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] opacity-40 dark:opacity-55"
        style={{ background: "var(--home-hero-glow)" }}
      />
      <div className="relative z-10 mx-auto max-w-5xl">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs text-[#6B6475] dark:text-slate-300/72">
        <Link href={localizePath("/", props.locale)} className="hover:text-[#0B0B0F] dark:hover:text-white">
          flatkey.ai
        </Link>
        <ChevronRight className="size-3" />
        <Link href={modelsUrl} className="hover:text-[#0B0B0F] dark:hover:text-white">
          {copy.backToModels}
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-mono text-[#0B0B0F]/80 dark:text-white/80">{props.modelName}</span>
      </nav>

      {/* Header */}
      <div className="mb-4 rounded-2xl border border-violet-500/16 bg-white/62 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.03]">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-violet-500/15 bg-white/70 shadow-[0_18px_48px_-34px_rgba(91,33,182,0.7)] dark:bg-white/[0.04]">
            <ModelLogo iconKey={props.iconKey} fallback={props.modelName.charAt(0).toUpperCase()} size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{props.modelName}</h1>
            {trendLoaded && (online || degraded) ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  online
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                <span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
                {online ? copy.statusOnline : copy.statusDegraded}
              </span>
            ) : null}
            </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6B6475] dark:text-slate-300/72">
            <span>{props.vendorName}</span>
            {props.endpointTypes.map((endpoint) => (
              <span
                key={endpoint}
                className="rounded-full border border-violet-500/20 bg-violet-500/8 px-2 py-0.5 font-mono text-[10px] text-violet-700 dark:text-violet-200"
              >
                {endpoint}
              </span>
            ))}
            {props.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[#0B0B0F14] bg-white/62 px-2 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/[0.04]">
                {tag}
              </span>
            ))}
          </div>
          </div>
        </div>

      {/* Intro + primary CTA */}
      <section className="mt-4">
        <p className="text-sm leading-relaxed text-[#37323F] dark:text-slate-200/82">{intro}</p>
        {about ? <p className="mt-2 text-sm leading-relaxed text-[#6B6475] dark:text-slate-300/72">{about}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={signUpUrl}
            className="flatkey-hero-cta inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-opacity hover:opacity-90"
          >
            {ui.ctaSignUp}
            <ArrowRight className="size-4" />
          </Link>
          {props.savingsPct > 0 ? (
            <span className="text-xs text-[#6B6475] dark:text-slate-300/72">
              {ui.saveVsOfficial.replace("{pct}", String(props.savingsPct))}
            </span>
          ) : null}
        </div>
      </section>
      </div>

      {/* Performance stat band */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<HeartPulse className="size-3.5" />}
          label={copy.successRate}
          value={trendLoaded ? formatSuccessRate(successRate) : "…"}
          tone="emerald"
        />
        <StatCard
          icon={<Zap className="size-3.5" />}
          label={copy.throughput}
          value={trendLoaded ? formatThroughput(summary?.avg_tps) : "…"}
          tone="violet"
        />
        <StatCard
          icon={<Timer className="size-3.5" />}
          label={copy.ttft}
          value={trendLoaded ? formatLatencyMs(ttft) : "…"}
          tone="violet"
        />
        <StatCard
          icon={<Activity className="size-3.5" />}
          label={copy.requests}
          value={trendLoaded ? formatCallCount(summary?.request_count) : "…"}
          tone="violet"
        />
      </div>

      {/* Discount */}
      <div className="mt-3 rounded-2xl border border-violet-500/16 bg-white/62 p-4 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm dark:bg-white/[0.03]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-violet-700 uppercase dark:text-violet-200">
          <BadgePercent className="size-3.5" />
          {copy.stackedDiscount}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-violet-700 dark:text-violet-200">{copy.upToOff}</span>
          <a
            href={props.consoleTopUpUrl}
            className="text-xs text-[#6B6475] underline decoration-dotted underline-offset-2 hover:text-[#0B0B0F] dark:text-slate-300/72 dark:hover:text-white"
          >
            {copy.discountNote} →
          </a>
        </div>
      </div>

      {/* Pricing */}
      <Section title={copy.pricing}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {props.priceRows.map((row) => (
            <div key={row.labelKey} className="rounded-xl border border-violet-500/14 bg-violet-500/[0.04] p-4 dark:bg-white/[0.025]">
              <div className="text-xs text-[#6B6475] dark:text-slate-300/72">{copy[row.labelKey]}</div>
              <div className="mt-1 font-mono text-sm text-[#6B6475]/80 tabular-nums dark:text-slate-300/60">
                {copy.listPrice} <span className="line-through">{row.list}</span>
              </div>
              <div className="mt-0.5 font-mono text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {row.discounted}
                <span className="ml-1 text-sm font-normal text-[#6B6475]/70 dark:text-slate-300/58">{copy.perMTokens}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Specifications */}
      <Section title={ui.specs}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <SpecRow label={ui.provider} value={props.vendorName} />
          <SpecRow label={ui.modality} value={modality} />
          <SpecRow label={ui.access} value="OpenAI-compatible API" />
          <SpecRow label={ui.endpoints} value={props.endpointTypes.join(", ") || "—"} mono />
        </dl>
      </Section>

      {/* How to use */}
      <Section title={ui.howToTitle.replace("{model}", props.modelName)}>
        <ol className="mb-4 space-y-3">
          {howTo.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-mono text-xs font-bold text-violet-700 dark:text-violet-300">
                {index + 1}
              </span>
              <div>
                <div className="text-sm font-semibold">{step.title}</div>
                <div className="text-sm leading-relaxed text-[#6B6475] dark:text-slate-300/72">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B6475] dark:text-slate-300/72">
            <Code2 className="size-3.5" />
            {copy.apiTitle}
          </span>
          <div className="flex gap-1">
            {CODE_LANGS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLang(item)}
                className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors ${
                  lang === item
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-200"
                    : "text-[#6B6475] hover:text-[#0B0B0F] dark:text-slate-300/72 dark:hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#0B0B0F] p-4 font-mono text-xs leading-relaxed text-zinc-100 shadow-[0_22px_60px_-44px_rgba(11,11,15,0.72)]">
          {example}
        </pre>
      </Section>

      {/* Comparison */}
      {props.comparison.length > 0 ? (
        <Section title={ui.compareTitle.replace("{model}", props.modelName)}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-violet-500/12 text-left text-xs text-[#6B6475] dark:text-slate-300/72">
                  <th className="py-2 font-medium">{ui.colModel}</th>
                  <th className="py-2 text-right font-medium">{ui.colInputPrice}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-violet-500/12 bg-violet-500/[0.05]">
                  <td className="py-2 font-mono font-semibold">{props.modelName}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{props.inputDiscounted}</td>
                </tr>
                {props.comparison.map((peer) => (
                  <tr key={peer.modelName} className="border-b border-violet-500/10 last:border-0">
                    <td className="py-2">
                      <Link href={peerUrl(peer.modelName)} className="font-mono text-violet-700 hover:underline dark:text-violet-200">
                        {peer.modelName}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{peer.inputPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {/* 30-day availability trend */}
      <Section title={copy.availability} icon={<Gauge className="size-3.5" />}>
        <div className="h-16">
          {trend.length > 1 ? (
            <DailyHealthBars points={trend} label={copy.availability} heightPx={64} />
          ) : (
            <div className="flex h-full items-center text-xs text-[#6B6475]/70 dark:text-slate-300/58">
              {trendLoaded ? copy.noData : "…"}
            </div>
          )}
        </div>
      </Section>

      {/* FAQ */}
      <Section title={ui.faqTitle}>
        <div className="divide-y divide-violet-500/10">
          {faq.map((item) => (
            <div key={item.q} className="py-3 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#6B6475] dark:text-slate-300/72">{item.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Related models */}
      {props.related.length > 0 ? (
        <Section title={ui.relatedTitle.replace("{vendor}", props.vendorName)}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {props.related.map((peer) => (
              <Link
                key={peer.modelName}
                href={peerUrl(peer.modelName)}
                className="flex items-center justify-between rounded-lg border border-violet-500/14 bg-white/46 px-3 py-2 text-sm transition-colors hover:border-violet-500/40 hover:bg-white/70 dark:bg-white/[0.025]"
              >
                <span className="truncate font-mono">{peer.modelName}</span>
                <span className="ml-2 shrink-0 font-mono text-xs text-[#6B6475] tabular-nums dark:text-slate-300/72">{peer.inputPrice}</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Final CTA */}
      <section className="mt-6 rounded-2xl border border-violet-500/16 bg-white/62 p-6 text-center shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.03]">
        <h2 className="text-lg font-bold">{ui.ctaTitle.replace("{model}", props.modelName)}</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-[#6B6475] dark:text-slate-300/72">{ui.ctaSubtitle}</p>
        <Link
          href={signUpUrl}
          className="flatkey-hero-cta mt-4 inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-semibold shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-opacity hover:opacity-90"
        >
          {ui.ctaSignUp}
          <ArrowRight className="size-4" />
        </Link>
      </section>
      </div>
    </main>
  );
}

function Section(props: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-violet-500/16 bg-white/62 p-4 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.58)] backdrop-blur-sm dark:bg-white/[0.03]">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-violet-700 uppercase dark:text-violet-200">
        {props.icon}
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function SpecRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-violet-500/14 py-1.5 last:border-0">
      <dt className="text-xs text-[#6B6475] dark:text-slate-300/72">{props.label}</dt>
      <dd className={`text-right text-sm ${props.mono ? "font-mono text-xs" : ""}`}>{props.value}</dd>
    </div>
  );
}

function StatCard(props: { icon: ReactNode; label: string; value: string; tone: "emerald" | "violet" }) {
  const border =
    props.tone === "emerald"
      ? "border-emerald-500/22 bg-emerald-500/[0.07]"
      : "border-violet-500/16 bg-white/62 dark:bg-white/[0.03]";
  const text = props.tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-[#0B0B0F] dark:text-white";
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.58)] backdrop-blur-sm ${border}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#6B6475] uppercase dark:text-slate-300/72">
        {props.icon}
        {props.label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${text}`}>{props.value}</div>
    </div>
  );
}
