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
    Promise.all([fetchModelTrend(model), fetchHealthSummary()]).then(([points, byName]) => {
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
  const online = successRate != null && successRate >= 99.5;
  const degraded = successRate != null && successRate < 99.5;

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
    <div className="mx-auto max-w-5xl px-4 pt-28 pb-16 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(schema) }} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-4 flex items-center gap-1 text-xs">
        <Link href={localizePath("/", props.locale)} className="hover:text-foreground">
          flatkey.ai
        </Link>
        <ChevronRight className="size-3" />
        <Link href={modelsUrl} className="hover:text-foreground">
          {copy.backToModels}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground/80 font-mono">{props.modelName}</span>
      </nav>

      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/15 bg-violet-500/6">
          <ModelLogo iconKey={props.iconKey} fallback={props.modelName.charAt(0).toUpperCase()} size={26} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-mono text-2xl font-bold tracking-tight">{props.modelName}</h1>
            {trendLoaded && (online || degraded) ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  online
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                <span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
                {online ? copy.statusOnline : copy.statusDegraded}
              </span>
            ) : null}
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span>{props.vendorName}</span>
            {props.endpointTypes.map((endpoint) => (
              <span
                key={endpoint}
                className="rounded-full border border-violet-500/20 bg-violet-500/5 px-2 py-0.5 font-mono text-[10px]"
              >
                {endpoint}
              </span>
            ))}
            {props.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-500/20 bg-zinc-500/5 px-2 py-0.5 text-[10px]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Intro + primary CTA */}
      <section className="mb-4">
        <p className="text-foreground/80 text-sm leading-relaxed">{intro}</p>
        {about ? <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{about}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={signUpUrl}
            className="flatkey-hero-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {ui.ctaSignUp}
            <ArrowRight className="size-4" />
          </Link>
          {props.savingsPct > 0 ? (
            <span className="text-muted-foreground text-xs">
              {ui.saveVsOfficial.replace("{pct}", String(props.savingsPct))}
            </span>
          ) : null}
        </div>
      </section>

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
      <div className="mt-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
          <BadgePercent className="size-3.5" />
          {copy.stackedDiscount}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-violet-700 dark:text-violet-300">{copy.upToOff}</span>
          <a
            href={props.consoleTopUpUrl}
            className="text-muted-foreground hover:text-foreground text-xs underline decoration-dotted underline-offset-2"
          >
            {copy.discountNote} →
          </a>
        </div>
      </div>

      {/* Pricing */}
      <Section title={copy.pricing}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {props.priceRows.map((row) => (
            <div key={row.labelKey} className="rounded-lg border bg-violet-500/[0.03] p-4">
              <div className="text-muted-foreground text-xs">{copy[row.labelKey]}</div>
              <div className="text-muted-foreground/70 mt-1 font-mono text-sm tabular-nums">
                {copy.listPrice} <span className="line-through">{row.list}</span>
              </div>
              <div className="mt-0.5 font-mono text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {row.discounted}
                <span className="text-muted-foreground/50 ml-1 text-sm font-normal">{copy.perMTokens}</span>
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
                <div className="text-muted-foreground text-sm leading-relaxed">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
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
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
          {example}
        </pre>
      </Section>

      {/* Comparison */}
      {props.comparison.length > 0 ? (
        <Section title={ui.compareTitle.replace("{model}", props.modelName)}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 font-medium">{ui.colModel}</th>
                  <th className="py-2 text-right font-medium">{ui.colInputPrice}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-violet-500/[0.04]">
                  <td className="py-2 font-mono font-semibold">{props.modelName}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{props.inputDiscounted}</td>
                </tr>
                {props.comparison.map((peer) => (
                  <tr key={peer.modelName} className="border-b last:border-0">
                    <td className="py-2">
                      <Link href={peerUrl(peer.modelName)} className="font-mono text-violet-600 hover:underline dark:text-violet-400">
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
            <div className="text-muted-foreground/60 flex h-full items-center text-xs">
              {trendLoaded ? copy.noData : "…"}
            </div>
          )}
        </div>
      </Section>

      {/* FAQ */}
      <Section title={ui.faqTitle}>
        <div className="divide-y">
          {faq.map((item) => (
            <div key={item.q} className="py-3 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.a}</p>
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
                className="hover:border-violet-500/40 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <span className="truncate font-mono">{peer.modelName}</span>
                <span className="text-muted-foreground ml-2 shrink-0 font-mono text-xs tabular-nums">{peer.inputPrice}</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Final CTA */}
      <section className="mt-6 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] to-emerald-500/[0.05] p-6 text-center">
        <h2 className="text-lg font-bold">{ui.ctaTitle.replace("{model}", props.modelName)}</h2>
        <p className="text-muted-foreground mx-auto mt-1 max-w-xl text-sm">{ui.ctaSubtitle}</p>
        <Link
          href={signUpUrl}
          className="flatkey-hero-cta mt-4 inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          {ui.ctaSignUp}
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}

function Section(props: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-xl border bg-white/60 p-4 dark:bg-white/[0.03]">
      <h2 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
        {props.icon}
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function SpecRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
      <dt className="text-muted-foreground text-xs">{props.label}</dt>
      <dd className={`text-right text-sm ${props.mono ? "font-mono text-xs" : ""}`}>{props.value}</dd>
    </div>
  );
}

function StatCard(props: { icon: ReactNode; label: string; value: string; tone: "emerald" | "violet" }) {
  const border =
    props.tone === "emerald" ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-violet-500/20 bg-violet-500/[0.04]";
  const text = props.tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
        {props.icon}
        {props.label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${text}`}>{props.value}</div>
    </div>
  );
}
